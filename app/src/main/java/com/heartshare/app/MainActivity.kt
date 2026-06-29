package com.heartshare.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.heartshare.app.ui.MainScreen
import com.heartshare.app.ui.MainViewModel

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val state by viewModel.uiState.collectAsState()
            val healthPermissionLauncher = rememberLauncherForActivityResult(
                contract = viewModel.permissionContract,
                onResult = viewModel::onPermissionsResult
            )
            val notificationPermissionLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.RequestPermission(),
                onResult = { viewModel.refresh() }
            )

            LaunchedEffect(Unit) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }

            MainScreen(
                state = state,
                onRequestPermission = {
                    healthPermissionLauncher.launch(viewModel.permissions)
                },
                onStart = viewModel::startSharing,
                onStop = viewModel::stopSharing
            )
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.refresh()
    }
}
