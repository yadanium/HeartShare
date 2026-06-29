package com.heartshare.app.data

data class HeartRatePayload(
    val heartRate: Long,
    val timestamp: Long,
    val online: Boolean
)
