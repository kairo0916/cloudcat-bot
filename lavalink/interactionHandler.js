const { MessageFlags } = require('discord.js');
const musicConfig = require('../config/music');

function createInteractionHandler(ctx) {
  const searchSessions = new Map();
  const queueSessions = new Map();
  const errorPrompts = new Map();
  const lastActionAt = new Map();

  function makeId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function registerSearchSession(session) {
    const id = makeId();
    searchSessions.set(id, { id, ...session });
    return id;
  }

  function bindSearchSession(id, patch) {
    const session = searchSessions.get(id);
    if (!session) return null;
    Object.assign(session, patch);
    return session;
  }

  function registerQueueSession(session) {
    const id = makeId();
    queueSessions.set(id, { id, ...session });
    return id;
  }

  function bindQueueSession(id, patch) {
    const session = queueSessions.get(id);
    if (!session) return null;
    Object.assign(session, patch);
    return session;
  }

  function registerErrorPrompt(session) {
    const id = makeId();
    errorPrompts.set(id, { id, ...session });
    return id;
  }

  function bindErrorPrompt(id, patch) {
    const session = errorPrompts.get(id);
    if (!session) return null;
    Object.assign(session, patch);
    return session;
  }

  function consumeSession(map, id) {
    const value = map.get(id);
    if (!value) return null;
    return value;
  }

  function clearSession(map, id) {
    map.delete(id);
  }

  function isDebounced(interaction) {
    if (!interaction?.guildId || !interaction?.user?.id || !interaction?.customId) return false;
    const key = `${interaction.guildId}:${interaction.user.id}:${interaction.customId}`;
    const now = Date.now();
    const prev = lastActionAt.get(key) || 0;
    if (now - prev < 800) {
      return true;
    }
    lastActionAt.set(key, now);
    return false;
  }

  async function cleanupSessionMessage(session, content = null) {
    if (!session?.channelId || !session?.messageId) return;
    const channel = ctx.client.channels.cache.get(session.channelId) || await ctx.client.channels.fetch(session.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const message = await channel.messages.fetch(session.messageId).catch(() => null);
    if (message) {
      const payload = { components: [] };
      if (content !== null) payload.content = content;
      if (content !== null) payload.embeds = [];
      await message.edit(payload).catch(() => {});
    }
  }

  async function finalizeSearchSession(session, interaction, content) {
    if (session?.messageId) {
      await cleanupSessionMessage(session);
    }
    clearSession(searchSessions, session.id);
    await interaction.update({ content, components: [], embeds: [] }).catch(async () => {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    });
  }

  async function handleSearchSelect(interaction) {
    const sessionId = interaction.customId.split(':')[2];
    const session = consumeSession(searchSessions, sessionId);
    if (!session) {
      return interaction.update({ content: '搜尋已逾時，請重新搜尋。', components: [], embeds: [] }).catch(() => {});
    }

    if (Date.now() > session.expiresAt) {
      await finalizeSearchSession(session, interaction, '搜尋已逾時，請重新搜尋。');
      return true;
    }

    if (session.userId && interaction.user.id !== session.userId) {
      return interaction.reply({ content: '這個選單不是給你的。', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const index = Number(interaction.values?.[0]);
    const track = session.tracks[index];
    if (!track) {
      return interaction.update({ content: '找不到歌曲。', components: [], embeds: [] }).catch(() => {});
    }

    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!player) {
      await finalizeSearchSession(session, interaction, '播放器不存在，請重新執行播放指令。');
      return true;
    }

    try {
      await ctx.queueManager.addSingleTrack(player, track, interaction.user, 'play');
      await ctx.queueManager.startIfIdle(player);
      await ctx.playerManager.touchPlaybackState(player, {
        state: {
          voiceChannelId: player.voiceChannelId,
          textChannelId: interaction.channelId,
          panelChannelId: interaction.channelId,
        },
      });
      await ctx.panelManager.sendOrEditNowPlaying(player, { status: 'playing' });
      await finalizeSearchSession(session, interaction, `已加入佇列：${track.info?.title || track.title || 'Unknown title'}`);
      return true;
    } catch (err) {
      await finalizeSearchSession(session, interaction, `加入失敗：${err.message || String(err)}`);
      return true;
    }
  }

  async function handleQueueAction(interaction) {
    const [, , sessionId, action] = interaction.customId.split(':');
    const session = consumeSession(queueSessions, sessionId);
    if (!session) {
      return interaction.update({ content: '隊列視窗已逾時，請重新開啟。', components: [], embeds: [] }).catch(() => {});
    }

    if (Date.now() > session.expiresAt) {
      clearSession(queueSessions, sessionId);
      return interaction.update({ content: '隊列視窗已逾時，請重新開啟。', components: [], embeds: [] }).catch(() => {});
    }

    if (interaction.user.id !== session.userId && session.userId) {
      return interaction.reply({ content: '這個隊列不是給你的。', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    if (action === 'close') {
      clearSession(queueSessions, sessionId);
      return interaction.update({ content: '已關閉隊列視窗。', embeds: [], components: [] }).catch(() => {});
    }

    if (action === 'prev') session.page = Math.max(1, (session.page || 1) - 1);
    if (action === 'next') session.page = Math.min(session.pages || 1, (session.page || 1) + 1);

    return ctx.panelManager.updateQueuePanel(interaction, session, session.page || 1).catch(() => {});
  }

  async function handleErrorPrompt(interaction) {
    const [, , sessionId, action] = interaction.customId.split(':');
    const session = consumeSession(errorPrompts, sessionId);
    if (!session) {
      return interaction.update({ content: '提示已逾時。', components: [] }).catch(() => {});
    }

    if (Date.now() > session.expiresAt) {
      clearSession(errorPrompts, sessionId);
      return interaction.update({ content: '提示已逾時。', components: [] }).catch(() => {});
    }

    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!ctx.playerManager.canControl(interaction.member, player, null)) {
      return interaction.reply({ content: '你沒有權限操作播放器。', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    if (!player) {
      clearSession(errorPrompts, sessionId);
      return interaction.update({ content: '播放器已不存在。', components: [] }).catch(() => {});
    }

    if (action === 'keep') {
      clearSession(errorPrompts, sessionId);
      return interaction.update({ content: '已保留播放器與佇列。', components: [] }).catch(() => {});
    }

    if (action === 'stop') {
      clearSession(errorPrompts, sessionId);
      await ctx.queueManager.clearQueueAndHistory(player).catch(() => {});
      await ctx.playerManager.destroy(player, 'track-error-stop', { clearState: true, clearQueue: false }).catch(() => {});
      await ctx.panelManager.handleTrackStopped(player).catch(() => {});
      return interaction.update({ content: '已停止播放並關閉面板。', components: [] }).catch(() => {});
    }

    return true;
  }

  async function handlePanelAction(interaction) {
    if (isDebounced(interaction)) {
      return interaction.reply({ content: '操作太快了，請稍等一下。', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.update({ content: '目前沒有可控制的播放器。', components: [], embeds: [] }).catch(() => {});
    }

    const requesterId = player.queue?.current?.musicMeta?.requesterId || null;
    if (!ctx.playerManager.canControl(interaction.member, player, requesterId)) {
      return interaction.reply({ content: '你沒有權限控制這個播放器。', flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const action = interaction.customId.split(':')[2];
    try {
      if (action === 'playpause') {
        if (player.paused) {
          await ctx.playerManager.resume(player);
          await ctx.panelManager.sendOrEditNowPlaying(player, { status: 'playing' });
        } else {
          await ctx.playerManager.pause(player);
          await ctx.panelManager.sendOrEditNowPlaying(player, { status: 'paused' });
        }
        return interaction.deferUpdate().catch(() => {});
      }

      if (action === 'prev') {
        await ctx.queueManager.playPrevious(player);
        await ctx.panelManager.sendOrEditNowPlaying(player, { status: 'playing' });
        return interaction.deferUpdate().catch(() => {});
      }

      if (action === 'next') {
        await ctx.queueManager.skipNext(player, 1);
        return interaction.deferUpdate().catch(() => {});
      }

      if (action === 'loop') {
        const current = player.repeatMode || 'off';
        const next = current === 'off' ? 'track' : current === 'track' ? 'queue' : 'off';
        await ctx.queueManager.setLoopMode(player, next);
        await ctx.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' });
        return interaction.deferUpdate().catch(() => {});
      }

      if (action === 'shuffle') {
        await ctx.queueManager.toggleShuffle(player);
        await ctx.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' });
        return interaction.deferUpdate().catch(() => {});
      }

      if (action === 'queue') {
        await ctx.panelManager.sendQueuePanel(player, 1, interaction.user.id);
        return interaction.deferUpdate().catch(() => {});
      }

      if (action === 'stop') {
        await ctx.queueManager.clearQueueAndHistory(player);
        await ctx.playerManager.destroy(player, 'manual-stop', { clearState: true, clearQueue: false });
        await ctx.panelManager.handleTrackStopped(player);
        return interaction.deferUpdate().catch(() => {});
      }
    } catch (err) {
      return interaction.reply({ content: err.message || String(err), flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    return false;
  }

  async function handle(interaction) {
    if (!interaction?.customId || !(interaction.isButton?.() || interaction.isStringSelectMenu?.())) return false;
    if (!interaction.customId.startsWith('music:')) return false;

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('music:search:')) {
      return handleSearchSelect(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith('music:panel:')) {
      return handlePanelAction(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith('music:queue:')) {
      return handleQueueAction(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith('music:error:')) {
      return handleErrorPrompt(interaction);
    }

    return false;
  }

  function cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of searchSessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        cleanupSessionMessage(session, '搜尋已逾時，請重新搜尋。').catch(() => {});
        searchSessions.delete(id);
      }
    }
    for (const [id, session] of queueSessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        cleanupSessionMessage(session, '隊列視窗已逾時，請重新開啟。').catch(() => {});
        queueSessions.delete(id);
      }
    }
    for (const [id, session] of errorPrompts.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        cleanupSessionMessage(session, '錯誤提示已逾時。').catch(() => {});
        errorPrompts.delete(id);
      }
    }
    for (const [key, time] of lastActionAt.entries()) {
      if (now - time > 5 * 60 * 1000) {
        lastActionAt.delete(key);
      }
    }
  }

  setInterval(cleanupExpired, 60_000).unref?.();

  return {
    handle,
    registerSearchSession,
    bindSearchSession,
    registerQueueSession,
    bindQueueSession,
    registerErrorPrompt,
    bindErrorPrompt,
    cleanupExpired,
  };
}

module.exports = createInteractionHandler;
