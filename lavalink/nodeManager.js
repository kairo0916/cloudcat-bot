const { LavalinkManager } = require('lavalink-client');
const musicConfig = require('../config/music');
const storage = require('./storage');
const logger = require('./logger');

class MusicQueueStore {
  async get(guildId) { const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId); return doc?.queue || undefined; }
  async set(guildId, value) {
    const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId) || { _id: guildId, guildId, queue: { current: null, previous: [], tracks: [], repeatMode: 'off' }, state: {}, settings: {}, stats: {}, createdAt: new Date().toISOString() };
    await storage.saveDocument(storage.COLLECTIONS.guilds, guildId, { ...doc, queue: value, updatedAt: new Date().toISOString() }); return true;
  }
  async delete(guildId) {
    const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId);
    if (!doc) return; await storage.saveDocument(storage.COLLECTIONS.guilds, guildId, { ...doc, queue: { current: null, previous: [], tracks: [], repeatMode: 'off' }, updatedAt: new Date().toISOString() });
  }
  async parse(value) { return typeof value === 'string' ? JSON.parse(value) : value; } stringify(value) { return value; }
}

// 🚀 核心修復：把背景的面板干擾全部清空，統一交給事件系統控制！
class MusicQueueWatcher {
  constructor(ctx) { this.ctx = ctx; }
  async shuffled(guildId) { /* 閉嘴 */ }
  async tracksAdd(guildId) { /* 閉嘴 */ }
  async tracksRemoved(guildId) { /* 閉嘴 */ }
}

function createNodeManager(ctx) {
  let initialized = false;
  async function init(botUser) {
    if (process.env.LAVALINK_ENABLE === 'false') {
      logger.warn({ emoji: '⚠️', title: 'Lavalink 系統已停用', details: '在 .env 中 LAVALINK_ENABLE=false' }); return null;
    }
    if (initialized || !musicConfig.enabled) return ctx.manager;
    initialized = true;

    try {
      const nodeOptions = [{
        id: 'main', host: process.env.LAVALINK_HOST, port: parseInt(process.env.LAVALINK_PORT, 10) || 80,
        authorization: process.env.LAVALINK_PASSWORD, secure: process.env.LAVALINK_PORT === '443' || process.env.LAVALINK_SECURE === 'true',
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }
      }];
      const clientId = botUser?.id || ctx.client.user?.id || '0';
      const clientUsername = botUser?.username || ctx.client.user?.username || 'bot';

      ctx.manager = new LavalinkManager({
        nodes: nodeOptions,
        sendToShard: (guildId, payload) => { const guild = ctx.client.guilds.cache.get(guildId); if (guild) guild.shard.send(payload); },
        client: { id: clientId, username: clientUsername },
        queueOptions: { queueStore: new MusicQueueStore(), queueChangesWatcher: new MusicQueueWatcher(ctx) }
      });
      
      ctx.manager.nodeManager.on('connect', (node) => logger.success({ emoji: '🟢', title: 'Node 已連線', node: node.id, details: `Host: ${node.options.host}` }));
      ctx.manager.nodeManager.on('error', (node, error) => logger.error({ emoji: '🔴', title: 'Node 發生錯誤', node: node.id, details: `原因：${error.message}` }));
      ctx.manager.nodeManager.on('disconnect', (node, reason) => logger.error({ emoji: '🔴', title: 'Node 斷線', node: node.id, details: `原因：${reason?.reason || 'Unknown'}` }));

      await ctx.manager.init({ id: clientId, username: clientUsername });
      logger.info({ emoji: '🎵', title: 'Lavalink 啟動中', details: '等待節點回應...' });
    } catch (err) { logger.error({ emoji: '❌', title: 'Lavalink 初始化異常', details: err.message }); return null; }

    ctx.client.on('raw', (d) => ctx.manager?.sendRawData(d)); return ctx.manager;
  }
  async function shutdown() { if (!ctx.manager) return; for (const player of ctx.manager.players.values()) await player.destroy('shutdown').catch(() => {}); }
  return { init, shutdown, MusicQueueStore, MusicQueueWatcher };
}
module.exports = createNodeManager;