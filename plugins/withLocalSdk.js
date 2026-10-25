const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const os = require('os');
const path = require('path');

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

function newestCmake(sdk) {
  const dir = path.join(sdk, 'cmake');
  if (!fs.existsSync(dir)) return null;
  const versions = fs
    .readdirSync(dir)
    .filter(v => /^\d+\.\d+\.\d+/.test(v))
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
      return 0;
    });
  return versions[0] ? path.join(dir, versions[0]) : null;
}

const escape = p => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

module.exports = function withLocalSdk(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const sdk = findSdk();
      if (!sdk) {
        console.warn('[withLocalSdk] Nie znaleziono Android SDK — ustaw ANDROID_HOME.');
        return cfg;
      }
      const lines = [`sdk.dir=${escape(sdk)}`];
      const cmake = newestCmake(sdk);
      if (cmake) lines.push(`cmake.dir=${escape(cmake)}`);
      fs.writeFileSync(path.join(cfg.modRequest.platformProjectRoot, 'local.properties'), lines.join('\n') + '\n');
      return cfg;
    },
  ]);
};