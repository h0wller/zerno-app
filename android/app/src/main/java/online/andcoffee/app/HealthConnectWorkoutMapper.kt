package online.andcoffee.app

import java.time.Duration
import java.time.Instant

internal data class HealthConnectWorkoutSnapshot(
    val id: String,
    val isRunning: Boolean,
    val startedAt: Instant,
    val endedAt: Instant,
    val distanceMeters: Double,
    val sourcePackageName: String,
    val deviceName: String?,
    val deviceModel: String?,
    val sourceProductType: String?,
    val recordingMethod: Int
)

internal object HealthConnectWorkoutMapper {
    private const val MAX_DURATION_SECONDS = 4 * 60 * 60L
    private const val MAX_DISTANCE_METERS = 250_000.0
    private const val MAX_SOURCE_LENGTH = 255

    fun recordingMethodLabel(value: Int): String = when (value) {
        1 -> "actively_recorded"
        2 -> "automatically_recorded"
        3 -> "manual_entry"
        else -> "unknown"
    }

    fun toMap(workout: HealthConnectWorkoutSnapshot): Map<String, Any>? {
        if (!workout.isRunning) return null
        if (workout.id.isBlank() || workout.id.length > MAX_SOURCE_LENGTH) return null
        if (workout.sourcePackageName.isBlank() ||
            workout.sourcePackageName.length > MAX_SOURCE_LENGTH
        ) return null
        if (!workout.endedAt.isAfter(workout.startedAt)) return null

        val durationSeconds = Duration.between(workout.startedAt, workout.endedAt).seconds
        if (durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) return null

        val distance = workout.distanceMeters
        if (!distance.isFinite() || distance < 0.0 || distance > MAX_DISTANCE_METERS) return null

        return linkedMapOf(
            "id" to workout.id,
            "activityType" to "running",
            "startedAt" to workout.startedAt.toString(),
            "endedAt" to workout.endedAt.toString(),
            "durationSeconds" to durationSeconds.toInt(),
            "distanceMeters" to distance.toInt(),
            "sourcePlatform" to "android_health_connect",
            "sourceName" to workout.sourcePackageName.take(120),
            "sourcePackageName" to workout.sourcePackageName,
            "deviceName" to (workout.deviceName ?: "").take(120),
            "deviceModel" to (workout.deviceModel ?: "").take(120),
            "sourceProductType" to (workout.sourceProductType ?: "").take(120),
            "recordingMethod" to recordingMethodLabel(workout.recordingMethod),
            "evidenceState" to "device_reported"
        )
    }
}
