const musicConfig = require('../config/music');
const storage = require('./storage');
const {
  attachMusicMeta,
  buildTrackKey,
  formatDuration,
  getRequesterId,
  normalizeTrackAuthor,
  normalizeTrackDuration,
  normalizeTrackTitle,
  truncate,
} = require('./shared');

const locks = new Map();

function withLock(key, fn) {
  const current = locks.get(key) || Promise.resolve();
  const next = current.catch(() => {}).then(fn);
  locks.set(key, next.finally(() => {
    if (locks.get(key) === next) locks.delete(key);
  }));
  return next;
}

function getTitleForCount(count) {
  if (count >= 10000) return '骨灰級音樂家';
  if (count >= 1000) return '終極音樂家';
  if (count >= 100) return '中級音樂家';
  if (count >= 10) return '見習音樂家';
  return null;
}

function buildRequesterSummary(track) {
  const requester = track?.musicMeta?.requesterTag || track?.requester?.username || track?.requester?.tag || track?.musicMeta?.requesterId || 'Unknown';
  return requester;
}

function countQueuedForUser(player, requesterId) {
  const tracks = [...(player?.queue?.tracks || [])];
  const current = player?.queue?.current ? [player.queue.current] : [];
  return [...current, ...tracks].filter(track => getRequesterId(track) === requesterId).length;
}

function interleaveTracksByRequester(tracks) {
  const buckets = new Map();
  const ordered = [];

  for (const track of tracks) {
    const key = getRequesterId(track) || track?.musicMeta?.requesterId || 'unknown';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(track);
  }

  const keys = [...buckets.keys()];
  let picked = true;
  while (picked) {
    picked = false;
    for (const key of keys) {
      const bucket = buckets.get(key);
      if (bucket && bucket.length > 0) {
        ordered.push(bucket.shift());
        picked = true;
      }
    }
  }

  return ordered;
}

function createQueueManager(ctx) {
  async function ensureGuildDoc(guildId) {
    return storage.loadDocument(storage.COLLECTIONS.guilds, guildId) || {
      _id: guildId,
      guildId,
      queue: { current: null, previous: [], tracks: [], repeatMode: 'off' },
      state: {},
      settings: {
        volume: musicConfig.defaultVolume,
        shuffleEnabled: false,
      },
      stats: {
        playCount: 0,
        requestCount: 0,
      },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  async function saveGuildDoc(guildId, patch) {
    const current = await ensureGuildDoc(guildId);
    const next = {
      ...current,
      ...patch,
      queue: patch.queue ? { ...current.queue, ...patch.queue } : current.queue,
      state: patch.state ? { ...current.state, ...patch.state } : current.state,
      settings: patch.settings ? { ...current.settings, ...patch.settings } : current.settings,
      stats: patch.stats ? { ...current.stats, ...patch.stats } : current.stats,
      updatedAt: new Date().toISOString(),
    };
    await storage.saveDocument(storage.COLLECTIONS.guilds, guildId, next);
    return next;
  }

  async function ensureTrackMeta(track, requester, origin = 'play') {
    const requesterId = requester?.id || requester?.user?.id || requester?.requesterId || null;
    const requesterTag = requester?.tag || requester?.user?.tag || requester?.username || requester?.user?.username || null;
    const cloned = attachMusicMeta(track, {
      requesterId,
      requesterTag,
      origin,
      counted: track?.musicMeta?.counted || false,
      addedAt: track?.musicMeta?.addedAt || new Date().toISOString(),
    });
    return cloned;
  }

  async function addTracks(player, tracks, requester, origin = 'play') {
    if (!player) throw new Error('Player not found');
    const guildId = player.guildId;
    const normalized = [];
    for (const track of tracks) {
      normalized.push(await ensureTrackMeta(track, requester, origin));
    }

    await withLock(`queue:${guildId}`, async () => {
      const queueSize = player.queue.tracks.length;
      if (queueSize + normalized.length > musicConfig.maxQueueSize) {
        throw new Error(`Queue limit reached (${musicConfig.maxQueueSize})`);
      }

      const requesterId = requester?.id || requester?.user?.id || null;
      if (requesterId) {
        const existingCount = countQueuedForUser(player, requesterId);
        if (existingCount + normalized.length > musicConfig.maxSongsPerUser) {
          throw new Error(`User queue limit reached (${musicConfig.maxSongsPerUser})`);
        }
      }

      await player.queue.add(normalized);
      const guildDoc = await ensureGuildDoc(guildId);
      const nextGuildStats = {
        ...guildDoc.stats,
        requestCount: (guildDoc.stats?.requestCount || 0) + (origin === 'play' ? normalized.length : 0),
      };

      await saveGuildDoc(guildId, {
        queue: player.queue.toJSON(),
        stats: nextGuildStats,
      });

      if (origin === 'play' && requesterId) {
        const userDoc = await storage.loadDocument(storage.COLLECTIONS.users, requesterId) || {
          _id: requesterId,
          userId: requesterId,
          playCount: 0,
          requestCount: 0,
          title: null,
          createdAt: new Date().toISOString(),
        };
        await storage.saveDocument(storage.COLLECTIONS.users, requesterId, {
          ...userDoc,
          requestCount: (userDoc.requestCount || 0) + normalized.length,
          updatedAt: new Date().toISOString(),
        });
      }

      for (const track of normalized) {
        const trackKey = buildTrackKey(track);
        const trackDoc = await storage.loadDocument(storage.COLLECTIONS.tracks, trackKey) || {
          _id: trackKey,
          trackKey,
          title: normalizeTrackTitle(track),
          author: normalizeTrackAuthor(track),
          duration: normalizeTrackDuration(track),
          playCount: 0,
          requestCount: 0,
          createdAt: new Date().toISOString(),
        };
        await storage.saveDocument(storage.COLLECTIONS.tracks, trackKey, {
          ...trackDoc,
          title: normalizeTrackTitle(track),
          author: normalizeTrackAuthor(track),
          duration: normalizeTrackDuration(track),
          uri: track?.info?.uri || track?.uri || null,
          identifier: track?.info?.identifier || track?.identifier || null,
          requestCount: (trackDoc.requestCount || 0) + 1,
          lastRequestedAt: new Date().toISOString(),
          lastRequesterId: requesterId || null,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return normalized;
  }

  async function addSingleTrack(player, track, requester, origin = 'play') {
    const [added] = await addTracks(player, [track], requester, origin);
    return added;
  }

  async function startIfIdle(player) {
    if (!player) return;
    if (!player.playing && !player.paused && (!player.queue.current || player.queue.current === null)) {
      await player.play();
    }
  }

  async function skipNext(player, amount = 1) {
    if (!player) throw new Error('Player not found');
    await player.skip(amount, true);
    await saveGuildDoc(player.guildId, { queue: player.queue.toJSON() });
  }

  async function playPrevious(player) {
    if (!player) throw new Error('Player not found');
    const previous = await player.queue.shiftPrevious();
    if (!previous) throw new Error('No previous track found');
    await player.play({ clientTrack: previous });
    await saveGuildDoc(player.guildId, { queue: player.queue.toJSON() });
    return previous;
  }

  async function setLoopMode(player, mode) {
    if (!player) throw new Error('Player not found');
    await player.setRepeatMode(mode);
    await saveGuildDoc(player.guildId, {
      queue: player.queue.toJSON(),
      settings: { repeatMode: mode },
    });
    return mode;
  }

  async function toggleShuffle(player) {
    if (!player) throw new Error('Player not found');
    if (player.queue.tracks.length < 2) {
      throw new Error('Queue needs at least 2 tracks to shuffle');
    }

    const current = await ensureGuildDoc(player.guildId);
    const nextState = !current.settings?.shuffleEnabled;
    if (nextState) {
      const reordered = interleaveTracksByRequester([...player.queue.tracks]);
      await player.queue.splice(0, player.queue.tracks.length, ...reordered);
    }

    await saveGuildDoc(player.guildId, {
      queue: player.queue.toJSON(),
      settings: { shuffleEnabled: nextState },
    });

    return nextState;
  }

  async function clearQueueAndHistory(player) {
    if (!player) return;
    await player.stopPlaying(true);
    if (player.queue?.tracks?.length) {
      await player.queue.splice(0, player.queue.tracks.length);
    }
    if (Array.isArray(player.queue?.previous)) {
      player.queue.previous.length = 0;
    }
    await saveGuildDoc(player.guildId, {
      queue: player.queue.toJSON(),
      settings: { shuffleEnabled: false, repeatMode: 'off' },
    });
  }

  async function recordSuccessfulPlay(player, track) {
    if (!player || !track) return;

    const musicMeta = track.musicMeta || {};
    if (musicMeta.counted) return;

    const guildId = player.guildId;
    const requesterId = musicMeta.requesterId || getRequesterId(track);
    const trackKey = buildTrackKey(track);
    const title = normalizeTrackTitle(track);
    const author = normalizeTrackAuthor(track);
    const duration = normalizeTrackDuration(track);
    const requesterTag = musicMeta.requesterTag || buildRequesterSummary(track);

    await withLock(`stats:${guildId}:${requesterId || 'unknown'}`, async () => {
      if (requesterId) {
        const userDoc = await storage.loadDocument(storage.COLLECTIONS.users, requesterId) || {
          _id: requesterId,
          userId: requesterId,
          playCount: 0,
          requestCount: 0,
          title: null,
          createdAt: new Date().toISOString(),
        };
        const playCount = (userDoc.playCount || 0) + 1;
        const titleName = getTitleForCount(playCount) || userDoc.title || null;
        await storage.saveDocument(storage.COLLECTIONS.users, requesterId, {
          ...userDoc,
          userId: requesterId,
          playCount,
          title: titleName,
          lastPlayedAt: new Date().toISOString(),
          lastRequesterTag: requesterTag,
          updatedAt: new Date().toISOString(),
        });
      }

      const guildDoc = await ensureGuildDoc(guildId);
      const guildPlayCount = (guildDoc.stats?.playCount || 0) + 1;
      await saveGuildDoc(guildId, {
        stats: {
          ...guildDoc.stats,
          playCount: guildPlayCount,
          lastPlayedAt: new Date().toISOString(),
          lastTrackKey: trackKey,
          lastTrackTitle: title,
        },
      });

      const trackDoc = await storage.loadDocument(storage.COLLECTIONS.tracks, trackKey) || {
        _id: trackKey,
        trackKey,
        title,
        author,
        duration,
        playCount: 0,
        requestCount: 0,
        createdAt: new Date().toISOString(),
      };
      await storage.saveDocument(storage.COLLECTIONS.tracks, trackKey, {
        ...trackDoc,
        title,
        author,
        duration,
        uri: track?.info?.uri || track?.uri || null,
        identifier: track?.info?.identifier || track?.identifier || null,
        source: track?.info?.sourceName || track?.sourceName || null,
        playCount: (trackDoc.playCount || 0) + 1,
        lastPlayedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    attachMusicMeta(track, { counted: true });
    if (player.queue?.utils?.sync) {
      await player.queue.utils.sync(true, false).catch(() => {});
    }
  }

  async function setPanelMessage(guildId, patch) {
    return saveGuildDoc(guildId, {
      state: patch,
    });
  }

  async function getGuildState(guildId) {
    return ensureGuildDoc(guildId);
  }

  async function getTopRequestedUsers(limit = 10) {
    const docs = await storage.loadAll(storage.COLLECTIONS.users);
    return docs
      .sort((a, b) => (b.requestCount || 0) - (a.requestCount || 0))
      .slice(0, limit);
  }

  async function getTopTracks(limit = 10) {
    const docs = await storage.loadAll(storage.COLLECTIONS.tracks);
    return docs
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
  }

  async function getTopGuilds(limit = 10) {
    const docs = await storage.loadAll(storage.COLLECTIONS.guilds);
    return docs
      .sort((a, b) => (b.stats?.playCount || 0) - (a.stats?.playCount || 0))
      .slice(0, limit);
  }

  return {
    ensureGuildDoc,
    saveGuildDoc,
    getGuildState,
    setPanelMessage,
    addTracks,
    addSingleTrack,
    startIfIdle,
    skipNext,
    playPrevious,
    setLoopMode,
    toggleShuffle,
    clearQueueAndHistory,
    recordSuccessfulPlay,
    countQueuedForUser,
    getTopRequestedUsers,
    getTopTracks,
    getTopGuilds,
  };
}

module.exports = createQueueManager;
