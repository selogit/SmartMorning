// Pozwala ekranowi budzika pojawić się na zablokowanym telefonie (full-screen intent z notifee)
// i włączyć ekran. Bez tych atrybutów Android pokazuje tylko powiadomienie.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withLockScreenAlarm(config) {
  return withAndroidManifest(config, cfg => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$['android:showWhenLocked'] = 'true';
    activity.$['android:turnScreenOn'] = 'true';
    return cfg;
  });
};
