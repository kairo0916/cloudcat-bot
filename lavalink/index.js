const logger = require('./logger');
const { formatDuration } = require('./shared');
const musicConfig = require('../config/music');
const storage = require('./storage');
const createPlayerManager = require('./playerManager');
const createQueueManager = require('./queueManager');
const createPanelManager = require('./panelManager');
const createSearchManager = require('./searchManager');
const createVoiceManager = require('./voiceManager');
const createInteractionHandler = require('./interactionHandler');
const createNodeManager = require('./nodeManager');

function createMusicSystem(client) {
  const ctx = { client, config: musicConfig, storage, manager: null, playerManager: null, queueManager: null, panelManager: null, searchManager: null, voiceManager: null, interactionHandler: null, nodeManager: null };
  ctx.playerManager = createPlayerManager(ctx); ctx.queueManager = createQueueManager(ctx); ctx.panelManager = createPanelManager(ctx);
  ctx.interactionHandler = createInteractionHandler(ctx); ctx.voiceManager = createVoiceManager(ctx); ctx.searchManager = createSearchManager(ctx); ctx.nodeManager = createNodeManager(ctx);

  // 🚀 核心修復：防止 Discord 重新連線時，重複綁定事件導致雙重日誌與面板
  let isEventsRegistered = false;

  const system = {
    enabled: musicConfig.enabled, config: musicConfig, manager: null, storage,
    playerManager: ctx.playerManager, queueManager: ctx.queueManager, panelManager: ctx.panelManager, searchManager: ctx.searchManager, voiceManager: ctx.voiceManager, interactionHandler: ctx.interactionHandler, nodeManager: ctx.nodeManager,
    async init(botUser) {
      await storage.init().catch((err) => console.error('[music] storage init failed:', err));
      if (!musicConfig.enabled) return null;
      const manager = await ctx.nodeManager.init(botUser || client.user || { id: client.user?.id, username: client.user?.username }).catch(() => null);
      ctx.manager = manager; system.manager = manager;

      // 如果還沒註冊過事件，才進行註冊
      if (!isEventsRegistered && manager) {
        isEventsRegistered = true;

        manager.on('trackStart', async (player, track) => {
          const guild = client.guilds.cache.get(player.guildId);
          logger.info({ emoji: '🎵', title: '開始播放', guild: guild?.name, user: track.requester?.tag || track.musicMeta?.requesterTag || 'Unknown', node: player.node?.id || 'MainNode', details: `歌曲：${track.info.title}\n作者：${track.info.author}\n長度：${formatDuration(track.info.length)}` });
          await ctx.panelManager.handleTrackStart(player, track).catch(() => {});
        });

        manager.on('trackEnd', (player, track, payload) => {
          if (payload.reason === 'replaced') return;
          const guild = client.guilds.cache.get(player.guildId);
          logger.info({ emoji: '✅', title: '歌曲播放完成', guild: guild?.name, details: `歌曲：${track.info.title}\n播放完成：${payload.reason === 'finished'}` });
        });

        manager.on('queueEnd', async (player, track, payload) => {
          if (player && !player.destroyed) {
            const guild = client.guilds.cache.get(player.guildId);
            logger.info({ emoji: '🛑', title: '隊列播放完畢', guild: guild?.name, details: '所有歌曲已播放完畢' });
            await ctx.panelManager.handleTrackStopped(player).catch(() => {});
          }
        });

        manager.on('trackError', (player, track, payload) => {
          const guild = client.guilds.cache.get(player.guildId);
          logger.error({ emoji: '❌', title: '播放失敗', guild: guild?.name, node: player.node?.id, details: `歌曲：${track?.info?.title || 'Unknown'}\n原因：${payload.error || 'Track load failed'}` });
        });

        setInterval(() => {
          const stats = logger.getSystemStats();
          logger.info({ emoji: '📊', title: '系統狀態', details: `Active Players: ${manager.players.size}\nGuilds: ${client.guilds.cache.size}\nCPU: ${stats.cpuStr}\nMemory: ${stats.memoryStr}\nUptime: ${stats.uptimeStr}` });
        }, 60 * 60 * 1000);
      }

      client.lavalink = manager; return manager;
    },
    async shutdown() { await ctx.nodeManager.shutdown().catch(() => {}); },
    async handleInteraction(interaction) { return ctx.interactionHandler.handle(interaction); },
    async handleVoiceStateUpdate(oldState, newState) { return ctx.voiceManager.handleVoiceStateUpdate(oldState, newState); },
  };
  client.music = system; client.on('raw', (d) => ctx.manager?.sendRawData(d)); return system;
}
module.exports = createMusicSystem;