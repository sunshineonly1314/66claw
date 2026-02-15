package ai.openclawcn.android.node

import android.os.Build
import ai.openclawcn.android.BuildConfig
import ai.openclawcn.android.SecurePrefs
import ai.openclawcn.android.gateway.GatewayClientInfo
import ai.openclawcn.android.gateway.GatewayConnectOptions
import ai.openclawcn.android.gateway.GatewayEndpoint
import ai.openclawcn.android.gateway.GatewayTlsParams
import ai.openclawcn.android.protocol.OpenClawCNCanvasA2UICommand
import ai.openclawcn.android.protocol.OpenClawCNCanvasCommand
import ai.openclawcn.android.protocol.OpenClawCNCameraCommand
import ai.openclawcn.android.protocol.OpenClawCNLocationCommand
import ai.openclawcn.android.protocol.OpenClawCNScreenCommand
import ai.openclawcn.android.protocol.OpenClawCNSmsCommand
import ai.openclawcn.android.protocol.OpenClawCNCapability
import ai.openclawcn.android.LocationMode
import ai.openclawcn.android.VoiceWakeMode

class ConnectionManager(
  private val prefs: SecurePrefs,
  private val cameraEnabled: () -> Boolean,
  private val locationMode: () -> LocationMode,
  private val voiceWakeMode: () -> VoiceWakeMode,
  private val smsAvailable: () -> Boolean,
  private val hasRecordAudioPermission: () -> Boolean,
  private val manualTls: () -> Boolean,
) {
  companion object {
    internal fun resolveTlsParamsForEndpoint(
      endpoint: GatewayEndpoint,
      storedFingerprint: String?,
      manualTlsEnabled: Boolean,
    ): GatewayTlsParams? {
      val stableId = endpoint.stableId
      val stored = storedFingerprint?.trim().takeIf { !it.isNullOrEmpty() }
      val isManual = stableId.startsWith("manual|")

      if (isManual) {
        if (!manualTlsEnabled) return null
        if (!stored.isNullOrBlank()) {
          return GatewayTlsParams(
            required = true,
            expectedFingerprint = stored,
            allowTOFU = false,
            stableId = stableId,
          )
        }
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = null,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      // Prefer stored pins. Never let discovery-provided TXT override a stored fingerprint.
      if (!stored.isNullOrBlank()) {
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = stored,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      val hinted = endpoint.tlsEnabled || !endpoint.tlsFingerprintSha256.isNullOrBlank()
      if (hinted) {
        // TXT is unauthenticated. Do not treat the advertised fingerprint as authoritative.
        return GatewayTlsParams(
          required = true,
          expectedFingerprint = null,
          allowTOFU = false,
          stableId = stableId,
        )
      }

      return null
    }
  }

  fun buildInvokeCommands(): List<String> =
    buildList {
      add(OpenClawCNCanvasCommand.Present.rawValue)
      add(OpenClawCNCanvasCommand.Hide.rawValue)
      add(OpenClawCNCanvasCommand.Navigate.rawValue)
      add(OpenClawCNCanvasCommand.Eval.rawValue)
      add(OpenClawCNCanvasCommand.Snapshot.rawValue)
      add(OpenClawCNCanvasA2UICommand.Push.rawValue)
      add(OpenClawCNCanvasA2UICommand.PushJSONL.rawValue)
      add(OpenClawCNCanvasA2UICommand.Reset.rawValue)
      add(OpenClawCNScreenCommand.Record.rawValue)
      if (cameraEnabled()) {
        add(OpenClawCNCameraCommand.Snap.rawValue)
        add(OpenClawCNCameraCommand.Clip.rawValue)
      }
      if (locationMode() != LocationMode.Off) {
        add(OpenClawCNLocationCommand.Get.rawValue)
      }
      if (smsAvailable()) {
        add(OpenClawCNSmsCommand.Send.rawValue)
      }
      if (BuildConfig.DEBUG) {
        add("debug.logs")
        add("debug.ed25519")
      }
      add("app.update")
    }

  fun buildCapabilities(): List<String> =
    buildList {
      add(OpenClawCNCapability.Canvas.rawValue)
      add(OpenClawCNCapability.Screen.rawValue)
      if (cameraEnabled()) add(OpenClawCNCapability.Camera.rawValue)
      if (smsAvailable()) add(OpenClawCNCapability.Sms.rawValue)
      if (voiceWakeMode() != VoiceWakeMode.Off && hasRecordAudioPermission()) {
        add(OpenClawCNCapability.VoiceWake.rawValue)
      }
      if (locationMode() != LocationMode.Off) {
        add(OpenClawCNCapability.Location.rawValue)
      }
    }

  fun resolvedVersionName(): String {
    val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
    return if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) {
      "$versionName-dev"
    } else {
      versionName
    }
  }

  fun resolveModelIdentifier(): String? {
    return listOfNotNull(Build.MANUFACTURER, Build.MODEL)
      .joinToString(" ")
      .trim()
      .ifEmpty { null }
  }

  fun buildUserAgent(): String {
    val version = resolvedVersionName()
    val release = Build.VERSION.RELEASE?.trim().orEmpty()
    val releaseLabel = if (release.isEmpty()) "unknown" else release
    return "OpenClawCNAndroid/$version (Android $releaseLabel; SDK ${Build.VERSION.SDK_INT})"
  }

  fun buildClientInfo(clientId: String, clientMode: String): GatewayClientInfo {
    return GatewayClientInfo(
      id = clientId,
      displayName = prefs.displayName.value,
      version = resolvedVersionName(),
      platform = "android",
      mode = clientMode,
      instanceId = prefs.instanceId.value,
      deviceFamily = "Android",
      modelIdentifier = resolveModelIdentifier(),
    )
  }

  fun buildNodeConnectOptions(): GatewayConnectOptions {
    return GatewayConnectOptions(
      role = "node",
      scopes = emptyList(),
      caps = buildCapabilities(),
      commands = buildInvokeCommands(),
      permissions = emptyMap(),
      client = buildClientInfo(clientId = "openclawcncn-android", clientMode = "node"),
      userAgent = buildUserAgent(),
    )
  }

  fun buildOperatorConnectOptions(): GatewayConnectOptions {
    return GatewayConnectOptions(
      role = "operator",
      scopes = listOf("operator.read", "operator.write", "operator.talk.secrets"),
      caps = emptyList(),
      commands = emptyList(),
      permissions = emptyMap(),
      client = buildClientInfo(clientId = "openclawcncn-control-ui", clientMode = "ui"),
      userAgent = buildUserAgent(),
    )
  }

  fun resolveTlsParams(endpoint: GatewayEndpoint): GatewayTlsParams? {
    val stored = prefs.loadGatewayTlsFingerprint(endpoint.stableId)
    return resolveTlsParamsForEndpoint(endpoint, storedFingerprint = stored, manualTlsEnabled = manualTls())
  }
}
