const fs = require('fs');
const path = require('path');

/**
 * Load key=value pairs from code/.env into process.env.
 * Existing process.env values win unless override=true.
 */
function loadMonorepoEnv(options = {}) {
  const envPath =
    options.envPath ?? path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    return { loaded: false, path: envPath, count: 0 };
  }

  let count = 0;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (options.override || process.env[key] === undefined) {
      process.env[key] = value;
      count += 1;
    }
  }

  return { loaded: true, path: envPath, count };
}

module.exports = { loadMonorepoEnv };
