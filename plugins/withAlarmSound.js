const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAlarmSound(config, { dir = './assets/sounds' } = {}) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const srcDir = path.join(cfg.modRequest.projectRoot, dir);
      const rawDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      const files = fs.existsSync(srcDir)
        ? fs.readdirSync(srcDir).filter(f => /\.(mp3|wav|ogg)$/i.test(f))
        : [];
      if (files.length === 0) {
        console.warn(`[withAlarmSound] Brak plików dźwięku w ${dir} — budzik użyje dźwięku domyślnego.`);
        return cfg;
      }
      fs.mkdirSync(rawDir, { recursive: true });
      for (const f of files) {
        fs.copyFileSync(path.join(srcDir, f), path.join(rawDir, f.toLowerCase()));
      }
      return cfg;
    },
  ]);
};
