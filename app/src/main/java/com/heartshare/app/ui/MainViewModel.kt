package com.heartshare.app.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.heartshare.app.data.HealthRepository
import com.heartshare.app.service.HeartRateForegroundService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val healthConnectAvailable: Boolean = false,
    val hasPermissions: Boolean = false,
    val serviceRunning: Boolean = false,
    val message: String = "Health Connectの状態を確認しています"
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val healthRepository = HealthRepository(application.applicationContext)
    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    val permissions: Set<String> = healthRepository.permissions
    val permissionContract = healthRepository.permissionContract

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val available = healthRepository.isHealthConnectAvailable()
            val granted = if (available) healthRepository.hasAllPermissions() else false
            _uiState.update {
                it.copy(
                    healthConnectAvailable = available,
                    hasPermissions = granted,
                    message = when {
                        !available -> "Health Connectをインストールまたは有効化してください"
                        !granted -> "心拍数の読み取り権限を許可してください"
                        it.serviceRunning -> "Firebaseへリアルタイム送信中です"
                        else -> "準備ができました"
                    }
                )
            }
        }
    }

    fun onPermissionsResult(grantedPermissions: Set<String>) {
        val granted = grantedPermissions.containsAll(permissions)
        _uiState.update {
            it.copy(
                hasPermissions = granted,
                message = if (granted) "準備ができました" else "心拍数の読み取り権限が必要です"
            )
        }
        if (granted) refresh()
    }

    fun startSharing() {
        val state = _uiState.value
        if (!state.healthConnectAvailable || !state.hasPermissions) {
            refresh()
            return
        }

        try {
            HeartRateForegroundService.start(getApplication())
            _uiState.update {
                it.copy(serviceRunning = true, message = "Firebaseへリアルタイム送信中です")
            }
        } catch (exception: Exception) {
            Log.e(TAG, "Failed to start foreground service", exception)
            _uiState.update {
                it.copy(message = "Foreground Serviceの開始に失敗しました")
            }
        }
    }

    fun stopSharing() {
        HeartRateForegroundService.stop(getApplication())
        _uiState.update {
            it.copy(serviceRunning = false, message = "送信を停止しました")
        }
    }

    companion object {
        private const val TAG = "MainViewModel"
    }
}
