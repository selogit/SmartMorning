// Notifee dostarcza bibliotekę natywną (app.notifee:core) w lokalnym repozytorium Maven w node_modules
// i dopisuje je do Gradle sam — ale przy buildzie release z --configure-on-demand robi to za późno.
// Dlatego dodajemy to repozytorium na stałe w android/build.gradle (allprojects.repositories).
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @notifee-local-maven';
const REPO = `    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" } ${MARKER}`;

module.exports = function withNotifeeRepo(config) {
  return withProjectBuildGradle(config, cfg => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let src = cfg.modResults.contents;
    if (!src.includes(MARKER)) {
      src = src.replace(/allprojects\s*\{\s*repositories\s*\{/, match => `${match}\n${REPO}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
