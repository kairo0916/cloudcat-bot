const { LavalinkManager } = require('lavalink-client');
const musicConfig = require('../config/music');
const storage = require('./storage');

class MusicQueueStore {
  async get(guildId) {
    const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId);
    return doc?.queue || undefined;
  }

  async set(guildId, value) {
    const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId) || {
      _id: guildId,
      guildId,
      state: {},
      settings: {},
      stats: {},
      createdAt: new Date().toISOString(),
    };
    await storage.saveDocument(storage.COLLECTIONS.guilds, guildId, {
      ...doc,
      queue: value,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  async delete(guildId) {
    const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId);
    if (!doc) return;
    await storage.saveDocument(storage.COLLECTIONS.guilds, guildId, {
      ...doc,
      queue: { current: null, previous: [], tracks: [], repeatMode: 'off' },
      updatedAt: new Date().toISOString(),
    });
  }

  async parse(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
  }

  stringify(value) {
    return value;
  }
}

class MusicQueueWatcher {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async shuffled(guildId) {
    const player = this.ctx.playerManager.getPlayer(guildId);
    if (player) {
      await this.ctx.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' }).catch(() => {});
    }
  }

  async tracksAdd(guildId) {
    const player = this.ctx.playerManager.getPlayer(guildId);
    if (player) {
      await this.ctx.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' }).catch(() => {});
    }
  }

  async tracksRemoved(guildId) {
    const player = this.ctx.playerManager.getPlayer(guildId);
    if (player) {
      await this.ctx.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' }).catch(() => {});
    }
  }
}

function createNodeManager(ctx) {
  let initialized = false;

  async function init(botUser) {
    if (initialized || !musicConfig.enabled) return ctx.manager;
    initialized = true;

    ctx.manager = new LavalinkManager({
      nodes: [
        {
          id: 'main',
          host: musicConfig.host,
          port: musicConfig.port,
          authorization: musicConfig.password,
          secure: false,
          retryAmount: 10,
          retryDelay: 5000,
        },
      ],
      sendToShard: (guildId, payload) => {
        const guild = ctx.client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
      autoSkip: true,
      client: {
        id: botUser?.id || ctx.client.user?.id || '0',
        username: botUser?.username || ctx.client.user?.username || 'bot',
      },
      playerOptions: {
        applyVolumeAsFilter: false,
        clientBasedPositionUpdateInterval: 250,
        defaultSearchPlatform: 'ytsearch',
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false,
        },
        onEmptyQueue: {
          destroyAfterMs: 30_000,
        },
        useUnresolvedData: true,
      },
      queueOptions: {
        maxPreviousTracks: musicConfig.historyLimit,
        queueStore: new MusicQueueStore(),
        queueChangesWatcher: new MusicQueueWatcher(ctx),
      },
      advancedOptions: {
        debugOptions: {
          noAudio: false,
          playerDestroy: {
            dontThrowError: false,
            debugLog: false,
          },
        },
      },
    });

    ctx.client.on('raw', (d) => ctx.manager?.sendRawData(d));

    ctx.manager.nodeManager.on('connect', (node) => {
      node.updateSession(true, 300_000);
    });

    ctx.manager.nodeManager.on('disconnect', (node, reason) => {
      console.warn(`[music] node disconnected: ${node.id}`, reason?.message || reason || '');
    });

    ctx.manager.nodeManager.on('reconnecting', (node) => {
      console.warn(`[music] node reconnecting: ${node.id}`);
    });

    ctx.manager.nodeManager.on('error', (node, error) => {
      console.error(`[music] node error: ${node.id}`, error?.message || error);
    });

    ctx.manager.nodeManager.on('resumed', (node) => {
      console.log(`[music] node resumed: ${node.id}`);
    });

    ctx.manager.on('trackStart', async (player, track) => {
      await ctx.queueManager.recordSuccessfulPlay(player, track).catch(() => {});
      await ctx.panelManager.handleTrackStart(player, track).catch(() => {});
    });

    ctx.manager.on('trackEnd', async (player, track, payload) => {
      if (payload?.reason === 'stopped') {
        await ctx.panelManager.handleTrackStopped(player).catch(() => {});
        return;
      }
      await ctx.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' }).catch(() => {});
    });

    ctx.manager.on('trackStuck', async (player, track, payload) => {
      await ctx.panelManager.showErrorPrompt(player, track, payload?.error || payload || new Error('Track stuck')).catch(() => {});
    });

    ctx.manager.on('trackError', async (player, track, payload) => {
      await ctx.panelManager.showErrorPrompt(player, track, payload?.error || payload || new Error('Track exception')).catch(() => {});
    });

    ctx.manager.on('queueEnd', async (player) => {
      await ctx.panelManager.handleTrackStopped(player).catch(() => {});
    });

    ctx.manager.on('playerDestroy', async (player) => {
      ctx.voiceManager.clearLeaveTimer(player.guildId);
    });

    ctx.manager.on('playerPaused', async (player) => {
      await ctx.panelManager.handleTrackPaused(player).catch(() => {});
    });

    ctx.manager.on('playerResumed', async (player) => {
      await ctx.panelManager.handleTrackStart(player, player.queue.current).catch(() => {});
    });

    return ctx.manager;
  }

  async function shutdown() {
    if (!ctx.manager) return;
    for (const player of ctx.manager.players.values()) {
      await player.destroy('shutdown').catch(() => {});
    }
  }

  return {
    init,
    shutdown,
    MusicQueueStore,
    MusicQueueWatcher,
  };
}

module.exports = createNodeManager;
