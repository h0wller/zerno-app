package online.andcoffee.app

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.permission.PermissionController
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

@CapacitorPlugin(name = "ZernoHealthConnect")
class HealthConnectPlugin : Plugin() {
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val permissionContract by lazy {
        PermissionController.createRequestPermissionResultContract()
    }

    private val requiredReadPermissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class)
    )

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val statusName = when (status) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "provider_update_required"
            else -> "unavailable"
        }
        call.resolve(JSObject().apply {
            put("available", status == HealthConnectClient.SDK_AVAILABLE)
            put("status", statusName)
        })
    }

    @PluginMethod
    fun getPermissionState(call: PluginCall) {
        val client = getClientOrReject(call) ?: return
        pluginScope.launch {
            try {
                resolvePermissionState(call, client.permissionController.getGrantedPermissions())
            } catch (_: Exception) {
                call.reject(
                    "Не удалось проверить разрешения Health Connect.",
                    "HEALTH_CONNECT_PERMISSION_CHECK_FAILED"
                )
            }
        }
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        val client = getClientOrReject(call) ?: return
        pluginScope.launch {
            try {
                val alreadyGranted = client.permissionController.getGrantedPermissions()
                val missing = requiredReadPermissions - alreadyGranted
                if (missing.isEmpty()) {
                    resolvePermissionState(call, alreadyGranted)
                    return@launch
                }

                startActivityForResult(
                    call,
                    permissionContract.createIntent(context, missing),
                    "onHealthConnectPermissionsResult"
                )
            } catch (_: Exception) {
                call.reject(
                    "Не удалось запросить разрешения Health Connect.",
                    "HEALTH_CONNECT_PERMISSION_REQUEST_FAILED"
                )
            }
        }
    }

    @ActivityCallback
    fun onHealthConnectPermissionsResult(call: PluginCall?, result: ActivityResult?) {
        if (call == null) return
        if (result == null) {
            call.reject("Ответ Health Connect не получен.", "HEALTH_CONNECT_PERMISSION_RESULT_MISSING")
            return
        }

        // Re-read OS grants after the activity result: the user can deny or revoke access independently.
        try {
            permissionContract.parseResult(result.resultCode, result.data)
        } catch (_: Exception) {
            // The authoritative state is getGrantedPermissions(), not the activity result payload.
        }

        val client = getClientOrReject(call) ?: return
        pluginScope.launch {
            try {
                resolvePermissionState(call, client.permissionController.getGrantedPermissions())
            } catch (_: Exception) {
                call.reject(
                    "Не удалось проверить разрешения Health Connect.",
                    "HEALTH_CONNECT_PERMISSION_CHECK_FAILED"
                )
            }
        }
    }

    @PluginMethod
    fun getRecentRunningWorkouts(call: PluginCall) {
        val client = getClientOrReject(call) ?: return
        val days = (call.getInt("days") ?: 30).coerceIn(1, 30)
        val limit = (call.getInt("limit") ?: 25).coerceIn(1, 25)

        pluginScope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(requiredReadPermissions)) {
                    call.reject(
                        "Разрешите чтение тренировок и дистанции в Health Connect.",
                        "HEALTH_CONNECT_PERMISSION_REQUIRED"
                    )
                    return@launch
                }

                val end = Instant.now()
                val start = end.minus(days.toLong(), ChronoUnit.DAYS)
                val sessions = mutableListOf<ExerciseSessionRecord>()
                var pageToken: String? = null
                var pageCount = 0

                do {
                    val response = client.readRecords(
                        ReadRecordsRequest(
                            recordType = ExerciseSessionRecord::class,
                            timeRangeFilter = TimeRangeFilter.between(start, end),
                            ascendingOrder = false,
                            pageSize = 100,
                            pageToken = pageToken
                        )
                    )
                    response.records.forEach { session ->
                        val isRunning =
                            session.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING ||
                            session.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL
                        if (isRunning && sessions.size < limit) sessions.add(session)
                    }
                    pageToken = response.pageToken
                    pageCount += 1
                } while (!pageToken.isNullOrBlank() && sessions.size < limit && pageCount < 5)

                val workouts = JSArray()
                for (session in sessions) {
                    // Restrict aggregation to the session's own data origin to avoid mixing
                    // duplicate distance samples from other apps.
                    val aggregate = client.aggregate(
                        AggregateRequest(
                            metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                            dataOriginFilter = setOf(session.metadata.dataOrigin)
                        )
                    )
                    val distanceMeters =
                        aggregate[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0
                    val device = session.metadata.device
                    val mapped = HealthConnectWorkoutMapper.toMap(
                        HealthConnectWorkoutSnapshot(
                            id = session.metadata.id,
                            isRunning = true,
                            startedAt = session.startTime,
                            endedAt = session.endTime,
                            distanceMeters = distanceMeters,
                            sourcePackageName = session.metadata.dataOrigin.packageName,
                            deviceName = device?.manufacturer,
                            deviceModel = device?.model,
                            sourceProductType = device?.type?.toString(),
                            recordingMethod = session.metadata.recordingMethod
                        )
                    ) ?: continue

                    val item = JSObject()
                    mapped.forEach { (key, value) -> item.put(key, value) }
                    workouts.put(item)
                }

                call.resolve(JSObject().apply {
                    put("workouts", workouts)
                    put("days", days)
                })
            } catch (_: Exception) {
                call.reject(
                    "Не удалось прочитать тренировки из Health Connect.",
                    "HEALTH_CONNECT_READ_FAILED"
                )
            }
        }
    }

    private fun getClientOrReject(call: PluginCall): HealthConnectClient? {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject(
                "Health Connect недоступен или требует обновления на этом устройстве.",
                "HEALTH_CONNECT_UNAVAILABLE"
            )
            return null
        }
        return try {
            HealthConnectClient.getOrCreate(context)
        } catch (_: Exception) {
            call.reject("Не удалось открыть Health Connect.", "HEALTH_CONNECT_CLIENT_FAILED")
            null
        }
    }

    private fun resolvePermissionState(call: PluginCall, granted: Set<String>) {
        call.resolve(JSObject().apply {
            put(
                "exerciseGranted",
                granted.contains(HealthPermission.getReadPermission(ExerciseSessionRecord::class))
            )
            put(
                "distanceGranted",
                granted.contains(HealthPermission.getReadPermission(DistanceRecord::class))
            )
            put("allGranted", granted.containsAll(requiredReadPermissions))
        })
    }

    override fun handleOnDestroy() {
        pluginScope.cancel()
        super.handleOnDestroy()
    }
}
