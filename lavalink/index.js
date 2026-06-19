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
  const ctx = {
    client,
    config: musicConfig,
    storage,
    manager: null,
    playerManager: null,
    queueManager: null,
    panelManager: null,
    searchManager: null,
    voiceManager: null,
    interactionHandler: null,
    nodeManager: null,
  };

  ctx.playerManager = createPlayerManager(ctx);
  ctx.queueManager = createQueueManager(ctx);
  ctx.panelManager = createPanelManager(ctx);
  ctx.interactionHandler = createInteractionHandler(ctx);
  ctx.voiceManager = createVoiceManager(ctx);
  ctx.searchManager = createSearchManager(ctx);
  ctx.nodeManager = createNodeManager(ctx);

  const system = {
    enabled: musicConfig.enabled,
    config: musicConfig,
    manager: null,
    storage,
    playerManager: ctx.playerManager,
    queueManager: ctx.queueManager,
    panelManager: ctx.panelManager,
    searchManager: ctx.searchManager,
    voiceManager: ctx.voiceManager,
    interactionHandler: ctx.interactionHandler,
    nodeManager: ctx.nodeManager,
    async init(botUser) {
      await storage.init().catch((err) => {
        console.error('[music] storage init failed:', err);
      });

      if (!musicConfig.enabled) {
        console.warn(`[music] disabled: ${musicConfig.reason || 'unknown reason'}`);
        return null;
      }

      const manager = await ctx.nodeManager.init(botUser || client.user || { id: client.user?.id, username: client.user?.username }).catch((err) => {
        console.error('[music] lavalink init failed:', err);
        return null;
      });

      ctx.manager = manager;
      system.manager = manager;
      client.lavalink = manager;
      return manager;
    },
    async shutdown() {
      await ctx.nodeManager.shutdown().catch(() => {});
    },
    async handleInteraction(interaction) {
      return ctx.interactionHandler.handle(interaction);
    },
    async handleVoiceStateUpdate(oldState, newState) {
      return ctx.voiceManager.handleVoiceStateUpdate(oldState, newState);
    },
  };

  client.music = system;
  client.on('raw', (d) => ctx.manager?.sendRawData(d));

  return system;
}

module.exports = createMusicSystem;
