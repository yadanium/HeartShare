package com.heartshare.app.data

import android.util.Log
import com.heartshare.app.BuildConfig
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.tasks.await

class FirebaseRepository(
    database: FirebaseDatabase = FirebaseDatabase.getInstance(BuildConfig.FIREBASE_DATABASE_URL)
) {
    private val liveRef = database.reference

    suspend fun sendHeartRate(payload: HeartRatePayload) {
        try {
            liveRef.updateChildren(
                mapOf(
                    "heartRate" to payload.heartRate,
                    "sampleTimestamp" to payload.sampleTimestamp,
                    "timestamp" to payload.timestamp,
                    "online" to payload.online,
                    "history/${payload.timestamp}/heartRate" to payload.heartRate,
                    "history/${payload.timestamp}/sampleTimestamp" to payload.sampleTimestamp,
                    "history/${payload.timestamp}/timestamp" to payload.timestamp
                )
            ).await()
            trimOldHistory(payload.timestamp)
            Log.d(
                TAG,
                "Heart rate sent: ${payload.heartRate} bpm sample=${payload.sampleTimestamp} sync=${payload.timestamp}"
            )
        } catch (exception: Exception) {
            Log.e(TAG, "Failed to send heart rate", exception)
            throw exception
        }
    }

    suspend fun setOnline(online: Boolean) {
        try {
            liveRef.child("online").setValue(online).await()
            liveRef.child("timestamp").setValue(System.currentTimeMillis()).await()
            Log.d(TAG, "Online state sent: $online")
        } catch (exception: Exception) {
            Log.e(TAG, "Failed to send online state", exception)
        }
    }

    private suspend fun trimOldHistory(now: Long) {
        try {
            val cutoff = now - HISTORY_RETENTION_MILLIS
            val snapshot = liveRef.child("history")
                .orderByChild("timestamp")
                .endAt(cutoff.toDouble())
                .get()
                .await()

            if (!snapshot.exists()) return

            val removals = snapshot.children.associate { child ->
                "history/${child.key}" to null
            }
            if (removals.isNotEmpty()) {
                liveRef.updateChildren(removals).await()
                Log.d(TAG, "Trimmed ${removals.size} old history points")
            }
        } catch (exception: Exception) {
            Log.e(TAG, "Failed to trim old history", exception)
        }
    }

    companion object {
        private const val TAG = "FirebaseRepository"
        private const val HISTORY_RETENTION_MILLIS = 48L * 60L * 60L * 1_000L
    }
}
