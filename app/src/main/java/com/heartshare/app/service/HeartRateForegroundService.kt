package com.heartshare.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.heartshare.app.R
import com.heartshare.app.data.FirebaseRepository
import com.heartshare.app.data.HealthRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class HeartRateForegroundService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var healthRepository: HealthRepository
    private lateinit var firebaseRepository: FirebaseRepository
    private var syncJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        healthRepository = HealthRepository(applicationContext)
        firebaseRepository = FirebaseRepository()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopSelf()
            else -> startSync()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        syncJob?.cancel()
        serviceScope.launch {
            firebaseRepository.setOnline(false)
        }
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun startSync() {
        if (syncJob?.isActive == true) return

        startForeground(NOTIFICATION_ID, buildNotification("心拍数を同期しています"))

        syncJob = serviceScope.launch {
            firebaseRepository.setOnline(true)

            while (isActive) {
                try {
                    if (!healthRepository.isHealthConnectAvailable()) {
                        Log.w(TAG, "Health Connect is not available")
                    } else if (!healthRepository.hasAllPermissions()) {
                        Log.w(TAG, "Health Connect permission is missing")
                    } else {
                        val payload = healthRepository.readLatestHeartRate()
                        if (payload != null) {
                            firebaseRepository.sendHeartRate(payload)
                        } else {
                            Log.w(TAG, "No heart rate sample found")
                        }
                    }
                } catch (exception: Exception) {
                    Log.e(TAG, "Unexpected sync failure", exception)
                }

                delay(SYNC_INTERVAL_MILLIS)
            }
        }
    }

    private fun buildNotification(text: String): Notification {
        val stopIntent = Intent(this, HeartRateForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = android.app.PendingIntent.getService(
            this,
            0,
            stopIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_heart_notification)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_heart_notification, "停止", stopPendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
        }

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "HeartRateService"
        private const val CHANNEL_ID = "heartshare_live"
        private const val NOTIFICATION_ID = 1001
        private const val SYNC_INTERVAL_MILLIS = 5_000L
        private const val ACTION_STOP = "com.heartshare.app.action.STOP"

        fun start(context: Context) {
            val intent = Intent(context, HeartRateForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, HeartRateForegroundService::class.java))
        }
    }
}
