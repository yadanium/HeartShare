package com.heartshare.app.data

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.temporal.ChronoUnit

class HealthRepository(private val context: Context) {
    private val client: HealthConnectClient by lazy {
        HealthConnectClient.getOrCreate(context)
    }

    val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class)
    )

    val permissionContract = PermissionController.createRequestPermissionResultContract()

    fun isHealthConnectAvailable(): Boolean {
        val status = HealthConnectClient.getSdkStatus(context)
        return status == HealthConnectClient.SDK_AVAILABLE
    }

    suspend fun hasAllPermissions(): Boolean {
        return try {
            client.permissionController.getGrantedPermissions().containsAll(permissions)
        } catch (exception: Exception) {
            Log.e(TAG, "Failed to read Health Connect permissions", exception)
            false
        }
    }

    suspend fun readLatestHeartRate(): HeartRatePayload? {
        val now = Instant.now()
        val lookupWindows = listOf(
            now.minus(10, ChronoUnit.MINUTES),
            now.minus(2, ChronoUnit.HOURS),
            now.minus(1, ChronoUnit.DAYS)
        )

        return try {
            lookupWindows.firstNotNullOfOrNull { start ->
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(start, now),
                        ascendingOrder = false,
                        pageSize = 1_000
                    )
                )

                response.records
                    .flatMap { record -> record.samples }
                    .maxByOrNull { sample -> sample.time }
                    ?.also { sample ->
                        Log.d(
                            TAG,
                            "Latest Health Connect heart rate: ${sample.beatsPerMinute} bpm at ${sample.time}"
                        )
                    }
            }?.let { sample ->
                HeartRatePayload(
                    heartRate = sample.beatsPerMinute,
                    sampleTimestamp = sample.time.toEpochMilli(),
                    timestamp = System.currentTimeMillis(),
                    online = true
                )
            }
        } catch (exception: Exception) {
            Log.e(TAG, "Failed to read latest heart rate", exception)
            null
        }
    }

    companion object {
        private const val TAG = "HealthRepository"
    }
}
