// Wyłącza R8 (minify/obfuskację) w buildach release.
// Notifee używa WorkManager 2.8 (Room), który tworzy bazę przez refleksję — R8 usuwa tę klasę
// i aplikacja wywala się przy starcie („Failed to create an instance of class androidx.work.impl.WorkDatabase”).
const { withGradleProperties } = require('expo/config-plugins');

const SETTINGS = {
  'android.enableMinifyInReleaseBuilds': 'false',
  'android.enableShrinkResourcesInReleaseBuilds': 'false',
};

module.exports = function withReleaseNoMinify(config) {
  return withGradleProperties(config, cfg => {
    for (const [key, value] of Object.entries(SETTINGS)) {
      const existing = cfg.modResults.find(item => item.type === 'property' && item.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
