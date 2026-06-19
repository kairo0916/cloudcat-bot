function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function truncate(text, maxLength) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${base}` : base;
}

function normalizeTrackTitle(track) {
  return track?.info?.title || track?.title || 'Unknown title';
}

function normalizeTrackAuthor(track) {
  return track?.info?.author || track?.author || 'Unknown artist';
}

function normalizeTrackDuration(track) {
  return Number(track?.info?.length ?? track?.info?.duration ?? track?.duration ?? 0);
}

function normalizeTrackUri(track) {
  return track?.info?.uri || track?.uri || '';
}

function normalizeTrackId(track) {
  return track?.info?.identifier || track?.identifier || normalizeTrackUri(track) || normalizeTrackTitle(track);
}

function getRequesterId(track) {
  return track?.musicMeta?.requesterId || track?.requester?.id || track?.requesterId || null;
}

function attachMusicMeta(track, meta = {}) {
  if (!track || typeof track !== 'object') return track;
  track.musicMeta = {
    ...(track.musicMeta || {}),
    ...meta,
  };
  return track;
}

function buildTrackKey(track) {
  return `${normalizeTrackId(track)}::${normalizeTrackTitle(track)}::${normalizeTrackAuthor(track)}::${normalizeTrackDuration(track)}`;
}

module.exports = {
  clamp,
  truncate,
  formatDuration,
  normalizeTrackTitle,
  normalizeTrackAuthor,
  normalizeTrackDuration,
  normalizeTrackUri,
  normalizeTrackId,
  getRequesterId,
  attachMusicMeta,
  buildTrackKey,
};
