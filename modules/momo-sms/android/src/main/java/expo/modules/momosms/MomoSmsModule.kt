package expo.modules.momosms

import android.Manifest
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import expo.modules.interfaces.permissions.PermissionsResponseListener
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val INBOX_CHANGED = "onInboxChanged"
private const val DEBOUNCE_MS = 1000L

class MomoSmsModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var observer: ContentObserver? = null
  private val emitChanged = Runnable { sendEvent(INBOX_CHANGED) }

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val reader
    get() = InboxReader(context.contentResolver)

  override fun definition() = ModuleDefinition {
    Name("MomoSms")

    Events(INBOX_CHANGED)

    // 'blocked' means the system will not show the dialog: "don't ask again", or the Android 13+
    // restricted setting for apps installed outside a store. Expo reports both as canAskAgain = false.
    AsyncFunction("getPermissionStatus") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.reject("E_NO_PERMISSIONS", "Permissions module is not linked", null)
      } else {
        permissions.getPermissions(statusListener(promise), Manifest.permission.READ_SMS)
      }
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.reject("E_NO_PERMISSIONS", "Permissions module is not linked", null)
      } else {
        permissions.askForPermissions(statusListener(promise), Manifest.permission.READ_SMS)
      }
    }

    AsyncFunction("listMomoMessageIds") { reader.listIds() }

    AsyncFunction("readMessagesByIds") { ids: List<Long> -> reader.readByIds(ids) }

    Function("startInboxObserver") {
      if (observer == null) {
        val created = object : ContentObserver(mainHandler) {
          override fun onChange(selfChange: Boolean) = scheduleEmit()
          override fun onChange(selfChange: Boolean, uri: Uri?) = scheduleEmit()
        }
        context.contentResolver.registerContentObserver(Telephony.Sms.CONTENT_URI, true, created)
        observer = created
      }
    }

    Function("stopInboxObserver") { stopObserver() }

    OnDestroy { stopObserver() }
  }

  // One SMS fires the observer several times (insert, read flag, thread update); one event goes out.
  private fun scheduleEmit() {
    mainHandler.removeCallbacks(emitChanged)
    mainHandler.postDelayed(emitChanged, DEBOUNCE_MS)
  }

  private fun stopObserver() {
    mainHandler.removeCallbacks(emitChanged)
    val resolver = appContext.reactContext?.contentResolver
    observer?.let { resolver?.unregisterContentObserver(it) }
    observer = null
  }

  private fun statusListener(promise: Promise) = PermissionsResponseListener { result ->
    val response = result[Manifest.permission.READ_SMS]
    promise.resolve(
      when {
        response == null -> "undetermined"
        response.status == PermissionsStatus.GRANTED -> "granted"
        response.status == PermissionsStatus.UNDETERMINED -> "undetermined"
        !response.canAskAgain -> "blocked"
        else -> "denied"
      },
    )
  }
}
