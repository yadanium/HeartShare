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

    companion object {
        private const val TAG = "FirebaseRepository"
    }
}
