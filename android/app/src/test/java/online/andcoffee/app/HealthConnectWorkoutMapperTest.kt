package online.andcoffee.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class HealthConnectWorkoutMapperTest {
    private val start = Instant.parse("2026-11-14T08:00:00Z")
    private val end = Instant.parse("2026-11-14T08:32:00Z")

    private fun workout(
        isRunning: Boolean = true,
        startedAt: Instant = start,
        endedAt: Instant = end,
        distanceMeters: Double = 5_200.0,
        sourcePackageName: String = "com.google.android.apps.fitness",
        recordingMethod: Int = 1
    ) = HealthConnectWorkoutSnapshot(
        id = "session-1",
        isRunning = isRunning,
        startedAt = startedAt,
        endedAt = endedAt,
        distanceMeters = distanceMeters,
        sourcePackageName = sourcePackageName,
        deviceName = "Google",
        deviceModel = "Pixel Watch",
        sourceProductType = "3",
        recordingMethod = recordingMethod
    )

    @Test
    fun mapsRunningSessionAsDeviceReportedOnly() {
        val result = HealthConnectWorkoutMapper.toMap(workout())

        assertNotNull(result)
        assertEquals("running", result!!["activityType"])
        assertEquals(5_200, result["distanceMeters"])
        assertEquals(1_920, result["durationSeconds"])
        assertEquals("android_health_connect", result["sourcePlatform"])
        assertEquals("actively_recorded", result["recordingMethod"])
        assertEquals("device_reported", result["evidenceState"])
        assertNull(result["verificationState"])
    }

    @Test
    fun rejectsNonRunningSessionsInvalidTimeAndInvalidMetrics() {
        assertNull(HealthConnectWorkoutMapper.toMap(workout(isRunning = false)))
        assertNull(HealthConnectWorkoutMapper.toMap(workout(endedAt = start)))
        assertNull(
            HealthConnectWorkoutMapper.toMap(
                workout(endedAt = start.plusSeconds(14_401))
            )
        )
        assertNull(HealthConnectWorkoutMapper.toMap(workout(distanceMeters = -1.0)))
        assertNull(HealthConnectWorkoutMapper.toMap(workout(distanceMeters = 250_001.0)))
        assertNull(HealthConnectWorkoutMapper.toMap(workout(sourcePackageName = "")))
    }

    @Test
    fun retainsManualRecordingSignalWithoutTrustUpgrade() {
        val result = HealthConnectWorkoutMapper.toMap(workout(recordingMethod = 3))

        assertNotNull(result)
        assertEquals("manual_entry", result!!["recordingMethod"])
        assertEquals("device_reported", result["evidenceState"])
        assertNull(result["verificationState"])
    }
}
