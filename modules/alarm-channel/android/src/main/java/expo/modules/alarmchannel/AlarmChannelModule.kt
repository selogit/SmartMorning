package expo.modules.alarmchannel

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tworzy kanał powiadomień, którego dźwięk gra na strumieniu ALARMU (AudioAttributes.USAGE_ALARM),
 * a nie powiadomień — dzięki temu budzik dzwoni także przy wyciszonym telefonie / trybie wibracji,
 * z głośnością ustawioną dla alarmów. Notifee nie pozwala ustawić AudioAttributes kanału,
 * więc kanał tworzymy tutaj; notifee tylko wysyła na niego powiadomienia.
 *
 * Uwaga: Android nie pozwala zmienić dźwięku istniejącego kanału, dlatego przy zmianie
 * ustawień trzeba użyć nowego ID kanału.
 */
class AlarmChannelModule : Module() {
  companion object {
    // Trzymane statycznie, żeby dźwięk grał dalej po przeładowaniu JS / ponownym utworzeniu modułu.
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    private val alarmAttributes: AudioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    private val vibrationPattern = longArrayOf(0, 600, 400, 600)

    fun soundUri(context: Context, soundName: String): Uri {
      val resId = context.resources.getIdentifier(soundName, "raw", context.packageName)
      return if (resId != 0) {
        Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/$resId")
      } else {
        Settings.System.DEFAULT_ALARM_ALERT_URI
      }
    }

    fun stopAll() {
      player?.let {
        try {
          if (it.isPlaying) it.stop()
        } catch (ignored: Exception) {
        }
        it.release()
      }
      player = null
      vibrator?.cancel()
      vibrator = null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AlarmChannel")

    Function("createAlarmChannel") { id: String, name: String, soundName: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@Function false
      }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val manager = context.getSystemService(NotificationManager::class.java)
        ?: return@Function false

      if (manager.getNotificationChannel(id) != null) {
        return@Function true
      }

      val soundUri = soundUri(context, soundName)
      val attributes = alarmAttributes

      val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Dźwięk budzika (strumień alarmu — działa przy wyciszonym telefonie)"
        setSound(soundUri, attributes)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 400, 600, 400, 600)
        setBypassDnd(true)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
      true
    }

    // Kanał bez dźwięku i wibracji — na niego przenosimy powiadomienie, gdy dźwięk gra już w aplikacji.
    Function("createSilentChannel") { id: String, name: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@Function false
      }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val manager = context.getSystemService(NotificationManager::class.java)
        ?: return@Function false
      if (manager.getNotificationChannel(id) == null) {
        val channel = NotificationChannel(id, name, NotificationManager.IMPORTANCE_LOW).apply {
          description = "Trwający alarm (dźwięk gra w aplikacji)"
          setSound(null, null)
          enableVibration(false)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
      }
      true
    }

    /**
     * Odtwarza dźwięk alarmu w pętli na strumieniu ALARMU, z wibracją. Gra niezależnie od powiadomienia —
     * dotknięcie powiadomienia ani rozwinięcie panelu go nie wycisza. Wyłącza go tylko stopAlarmSound().
     */
    Function("startAlarmSound") { soundName: String ->
      if (player != null) {
        return@Function true
      }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val mp = MediaPlayer()
      try {
        mp.setAudioAttributes(alarmAttributes)
        mp.setDataSource(context, soundUri(context, soundName))
        mp.isLooping = true
        mp.prepare()
        mp.start()
        player = mp
      } catch (e: Exception) {
        mp.release()
        throw e
      }

      val vib: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(VibratorManager::class.java)?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
      if (vib != null && vib.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          @Suppress("DEPRECATION")
          vib.vibrate(VibrationEffect.createWaveform(vibrationPattern, 0), alarmAttributes)
        } else {
          @Suppress("DEPRECATION")
          vib.vibrate(vibrationPattern, 0)
        }
        vibrator = vib
      }
      true
    }

    Function("stopAlarmSound") {
      stopAll()
      true
    }

    Function("isAlarmSoundPlaying") {
      player != null
    }

    Function("deleteChannel") { id: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        return@Function false
      }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context.getSystemService(NotificationManager::class.java)?.deleteNotificationChannel(id)
      true
    }
  }
}
