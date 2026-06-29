package com.heartshare.app

import android.app.Application
import com.google.firebase.FirebaseApp

class HeartShareApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}
