const path = require('path');

function parseBoolean(value, key, defaultValue = false, errors) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  errors.push(`${key} must be a boolean (true/false)`);
  return defaultValue;
}

function parseNumber(value, key, defaultValue, errors, { min = null, max = null, integer = true } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    errors.push(`${key} must be a number`);
    return defaultValue;
  }
  if (integer && !Number.isInteger(num)) {
    errors.push(`${key} must be an integer`);
    return defaultValue;
  }
  if (min !== null && num < min) {
    errors.push(`${key} must be >= ${min}`);
    return defaultValue;
  }
  if (max !== null && num > max) {
    errors.push(`${key} must be <= ${max}`);
    return defaultValue;
  }
  return num;
}

const errors = [];

const musicEnable = parseBoolean(process.env.MUSIC_ENABLE, 'MUSIC_ENABLE', false, errors);
const lavalinkEnable = parseBoolean(process.env.LAVALINK_ENABLE, 'LAVALINK_ENABLE', false, errors);
const mongodbEnable = parseBoolean(process.env.MONGODB_ENABLE, 'MONGODB_ENABLE', false, errors);
const achievementEnable = parseBoolean(process.env.MUSIC_ACHIEVEMENT_ENABLE, 'MUSIC_ACHIEVEMENT_ENABLE', true, errors);
const leaderboardEnable = parseBoolean(process.env.MUSIC_LEADERBOARD_ENABLE, 'MUSIC_LEADERBOARD_ENABLE', true, errors);

const defaultVolume = parseNumber(process.env.MUSIC_DEFAULT_VOLUME, 'MUSIC_DEFAULT_VOLUME', 50, errors, {
  min: 1,
  max: 100,
});
const maxQueueSize = parseNumber(process.env.MUSIC_MAX_QUEUE_SIZE, 'MUSIC_MAX_QUEUE_SIZE', 20, errors, {
  min: 1,
  max: 1000,
});
const maxSongsPerUser = parseNumber(process.env.MUSIC_MAX_SONGS_PER_USER, 'MUSIC_MAX_SONGS_PER_USER', 3, errors, {
  min: 1,
  max: 100,
});
const historyLimit = parseNumber(process.env.MUSIC_HISTORY_LIMIT, 'MUSIC_HISTORY_LIMIT', 30, errors, {
  min: 1,
  max: 1000,
});
const emptyChannelTimeoutSeconds = parseNumber(process.env.MUSIC_EMPTY_CHANNEL_TIMEOUT, 'MUSIC_EMPTY_CHANNEL_TIMEOUT', 300, errors, {
  min: 1,
  max: 86400,
});
const searchTimeoutSeconds = parseNumber(process.env.MUSIC_SEARCH_TIMEOUT, 'MUSIC_SEARCH_TIMEOUT', 30, errors, {
  min: 1,
  max: 300,
});
const lavalinkPort = parseNumber(process.env.LAVALINK_PORT, 'LAVALINK_PORT', 2333, errors, {
  min: 1,
  max: 65535,
});

const host = (process.env.LAVALINK_HOST || '').trim();
const password = (process.env.LAVALINK_PASSWORD || '').trim();
const mongoUrl = (process.env.MONGODB_URL || '').trim();

if (musicEnable && lavalinkEnable) {
  if (!host) errors.push('LAVALINK_HOST is required when MUSIC_ENABLE and LAVALINK_ENABLE are true');
  if (!password) errors.push('LAVALINK_PASSWORD is required when MUSIC_ENABLE and LAVALINK_ENABLE are true');
}

if (musicEnable && mongodbEnable && !mongoUrl) {
  errors.push('MONGODB_URL is required when MUSIC_ENABLE and MONGODB_ENABLE are true');
}

const enabled = musicEnable && lavalinkEnable && errors.length === 0;
const reason = !musicEnable
  ? 'MUSIC_ENABLE is false'
  : !lavalinkEnable
    ? 'LAVALINK_ENABLE is false'
    : errors.length > 0
      ? 'Invalid music environment'
      : null;

module.exports = {
  enabled,
  reason,
  errors,
  musicEnable,
  lavalinkEnable,
  mongodbEnable,
  achievementEnable,
  leaderboardEnable,
  defaultVolume,
  maxQueueSize,
  maxSongsPerUser,
  historyLimit,
  emptyChannelTimeoutSeconds,
  searchTimeoutSeconds,
  emptyChannelTimeoutMs: emptyChannelTimeoutSeconds * 1000,
  searchTimeoutMs: searchTimeoutSeconds * 1000,
  host,
  port: lavalinkPort,
  password,
  mongoUrl,
  dataDir: path.join(process.cwd(), 'data', 'music'),
};
