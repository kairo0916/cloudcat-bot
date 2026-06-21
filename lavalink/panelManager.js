const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const musicConfig = require('../config/music');
const { clamp, formatDuration, normalizeTrackAuthor, normalizeTrackDuration, normalizeTrackTitle, truncate } = require('./shared');

// 🚀 核心修復：使用 Promise 鏈取代單純的 while 迴圈，達成「絕對排隊機制」
const panelLocks = new Map();
function withPanelLock(guildId, task) {
  const prev = panelLocks.get(guildId) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  panelLocks.set(guildId, next);
  return next;
}

function createPanelManager(ctx) {
  function buildFooter(player, state) {
    const loop = state?.queue?.repeatMode || player?.repeatMode || 'off';
    const shuffleEnabled = Boolean(state?.settings?.shuffleEnabled);
    const volume = state?.settings?.volume || player?.volume || musicConfig.defaultVolume;
    return `循環: ${loop} | 交錯: ${shuffleEnabled ? 'on' : 'off'} | 音量: ${clamp(volume, 1, 100)}%`;
  }

  function buildNowPlayingEmbed(player, state, status = 'playing') {
    const current = player?.queue?.current;
    const queueSize = player?.queue?.tracks?.length || 0;

    const embed = new EmbedBuilder()
      .setColor(status === 'paused' ? 0xF1C40F : status === 'stopped' ? 0xED4245 : 0x57F287)
      .setFooter({ text: buildFooter(player, state) })
      .setTimestamp();

    if (status === 'stopped' || !current) {
      embed.setTitle('✅ 播放完畢！');
      embed.setDescription('列表裡沒有歌曲了，使用 `/音樂 播放` 進行添加，或者點擊下方按鈕添加！');
    } else {
      const title = normalizeTrackTitle(current);
      const author = normalizeTrackAuthor(current);
      const requester = current?.musicMeta?.requesterTag || current?.requester?.tag || current?.requester?.username || 'Unknown';
      const duration = formatDuration(normalizeTrackDuration(current));

      embed.setTitle(`${status === 'paused' ? '⏸️ 已暫停' : '✅ 正在播放'} ${truncate(title, 80)}`);
      embed.setDescription([
        `👤 作者: ${truncate(author, 80)}`,
        `👤 點播者: ${truncate(requester, 80)}`,
        `🎵 歌曲長度: ${duration}`,
        `📜 隊列: ${queueSize}`,
      ].join('\n'));

      const artwork = current?.info?.artworkUrl || current?.info?.thumbnail || current?.thumbnail;
      if (artwork) embed.setThumbnail(artwork);
    }
    return embed;
  }

  async function getMainComponents(player, status = 'playing') {
    if (status === 'stopped') {
      return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music:panel:addsong').setLabel('➕ 添加歌曲').setStyle(ButtonStyle.Success)
      )];
    }

    const current = player?.queue?.current;
    const paused = Boolean(player?.paused);
    const repeatMode = player?.repeatMode || 'off';
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const shuffleEnabled = Boolean(state?.settings?.shuffleEnabled);
    const noTrack = !current;

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music:panel:playpause').setLabel(paused ? '▶️ 播放' : '⏸️ 暫停').setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(noTrack),
      new ButtonBuilder().setCustomId('music:panel:prev').setLabel('⏮️ 上一首').setStyle(ButtonStyle.Primary).setDisabled(noTrack || !player?.queue?.previous?.length),
      new ButtonBuilder().setCustomId('music:panel:next').setLabel('⏭️ 下一首').setStyle(ButtonStyle.Primary).setDisabled(noTrack && !player?.queue?.tracks?.length),
      new ButtonBuilder().setCustomId('music:panel:loop').setLabel(`🔁 ${repeatMode === 'track' ? '單曲' : repeatMode === 'queue' ? '隊列' : '循環'}`).setStyle(ButtonStyle.Secondary).setDisabled(noTrack),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music:panel:addsong').setLabel('➕ 添加歌曲').setStyle(ButtonStyle.Success), 
      new ButtonBuilder().setCustomId('music:panel:shuffle').setLabel(shuffleEnabled ? '🔀 交錯 on' : '🔀 交錯 off').setStyle(shuffleEnabled ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled((player?.queue?.tracks?.length || 0) < 2),
      new ButtonBuilder().setCustomId('music:panel:queue').setLabel('📜 隊列').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music:panel:stop').setLabel('🛑 停止').setStyle(ButtonStyle.Danger).setDisabled(noTrack),
    );

    return [row1, row2];
  }

  async function savePanelRefs(player, channelId, messageId) {
    await ctx.playerManager.updatePanelRefs(player.guildId, { panelChannelId: channelId, panelMessageId: messageId, textChannelId: channelId });
  }

  async function sendOrEditNowPlaying(player, { status = 'playing', forceNew = false } = {}) {
    if (!player) return null;
    const guildId = player.guildId;

    // 將所有發送邏輯包裝在絕對排隊鎖內
    return withPanelLock(guildId, async () => {
      const state = await ctx.playerManager.getGuildState(guildId);
      const targetChannelId = state?.state?.textChannelId;
      if (!targetChannelId) return null;
      
      const targetChannel = ctx.client.channels.cache.get(targetChannelId) || await ctx.client.channels.fetch(targetChannelId).catch(() => null);
      if (!targetChannel || !targetChannel.isTextBased()) return null;

      const embed = buildNowPlayingEmbed(player, state, status);
      const components = await getMainComponents(player, status);
      const payload = { embeds: [embed], components };

      const oldChannelId = state?.state?.panelChannelId;
      const oldMessageId = state?.state?.panelMessageId;
      let oldMessage = null;

      if (oldChannelId && oldMessageId) {
        const oldChannel = ctx.client.channels.cache.get(oldChannelId) || await ctx.client.channels.fetch(oldChannelId).catch(() => null);
        if (oldChannel && oldChannel.messages) {
          oldMessage = await oldChannel.messages.fetch(oldMessageId).catch(() => null);
        }
      }

      const channelSwitched = oldChannelId && targetChannelId && oldChannelId !== targetChannelId;

      if (forceNew || channelSwitched) {
        if (oldMessage) await oldMessage.delete().catch(() => {});
        const sent = await targetChannel.send(payload).catch(() => null);
        if (sent) await savePanelRefs(player, targetChannel.id, sent.id);
        return sent;
      } 
      
      if (oldMessage) {
        try { return await oldMessage.edit(payload); } catch (err) {}
      }
      
      const sent = await targetChannel.send(payload).catch(() => null);
      if (sent) await savePanelRefs(player, targetChannel.id, sent.id);
      return sent;
    });
  }

  async function markStopped(player) {
    return sendOrEditNowPlaying(player, { status: 'stopped', forceNew: true });
  }

  function buildQueueEmbed(player, state, page = 1) {
    const current = player?.queue?.current;
    const tracks = [...(player?.queue?.tracks || [])];
    const itemsPerPage = 10;
    const pages = Math.max(1, Math.ceil(tracks.length / itemsPerPage));
    const safePage = clamp(page, 1, pages);
    const start = (safePage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageTracks = tracks.slice(start, end);

    const lines = [];
    if (current) lines.push(`**正在播放** ${truncate(normalizeTrackTitle(current), 60)} • ${formatDuration(normalizeTrackDuration(current))}`);
    if (pageTracks.length === 0) lines.push('沒有更多歌曲。');
    else pageTracks.forEach((track, index) => lines.push(`${start + index + 1}. ${truncate(normalizeTrackTitle(track), 58)} • ${formatDuration(normalizeTrackDuration(track))}`));

    const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`📜 隊列清單 第 ${safePage} / ${pages} 頁`).setDescription(lines.join('\n')).setFooter({ text: `共 ${tracks.length} 首 | ${buildFooter(player, state)}` }).setTimestamp();
    return { embed, pages, safePage };
  }

  async function sendQueuePanel(player, page = 1, userId = null) {
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const channelId = state?.state?.textChannelId;
    if (!channelId) return null;
    const channel = ctx.client.channels.cache.get(channelId) || await ctx.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return null;

    const { embed, pages, safePage } = buildQueueEmbed(player, state, page);
    const sessionId = ctx.interactionHandler.registerQueueSession({ guildId: player.guildId, userId, channelId: channel.id, messageId: null, page: safePage, pages, expiresAt: Date.now() + musicConfig.searchTimeoutMs });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music:queue:${sessionId}:prev`).setLabel('◀ 上一頁').setStyle(ButtonStyle.Primary).setDisabled(safePage <= 1),
      new ButtonBuilder().setCustomId(`music:queue:${sessionId}:next`).setLabel('下一頁 ▶').setStyle(ButtonStyle.Primary).setDisabled(safePage >= pages),
      new ButtonBuilder().setCustomId(`music:queue:${sessionId}:close`).setLabel('關閉').setStyle(ButtonStyle.Danger),
    );

    const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (sent) ctx.interactionHandler.bindQueueSession(sessionId, { messageId: sent.id });
    return sent;
  }

  async function updateQueuePanel(interaction, session, page) {
    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!player) return interaction.update({ content: '播放器不存在。', components: [], embeds: [] });
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const { embed, pages, safePage } = buildQueueEmbed(player, state, page);
    session.page = safePage; session.pages = pages;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music:queue:${session.id}:prev`).setLabel('◀ 上一頁').setStyle(ButtonStyle.Primary).setDisabled(safePage <= 1),
      new ButtonBuilder().setCustomId(`music:queue:${session.id}:next`).setLabel('下一頁 ▶').setStyle(ButtonStyle.Primary).setDisabled(safePage >= pages),
      new ButtonBuilder().setCustomId(`music:queue:${session.id}:close`).setLabel('關閉').setStyle(ButtonStyle.Danger),
    );
    return interaction.update({ embeds: [embed], components: [row] });
  }

  async function showErrorPrompt(player, track, reason) {
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const channelId = state?.state?.textChannelId;
    if (!channelId) return null;
    const channel = ctx.client.channels.cache.get(channelId) || await ctx.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return null;

    const sessionId = ctx.interactionHandler.registerErrorPrompt({ guildId: player.guildId, channelId: channel.id, playerGuildId: player.guildId, trackKey: track?.musicMeta?.requestId || track?.info?.identifier || null, expiresAt: Date.now() + 30_000 });

    const embed = new EmbedBuilder().setColor(0xED4245).setTitle('⚠️ 歌曲無法播放').setDescription([`歌曲：${truncate(normalizeTrackTitle(track), 80)}`, `原因：${truncate(reason?.message || String(reason || 'Unknown error'), 500)}`, '', '要保留播放器與隊列嗎？'].join('\n')).setFooter({ text: '30 秒內未操作將自動忽略' }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music:error:${sessionId}:keep`).setLabel('保留播放器').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`music:error:${sessionId}:stop`).setLabel('停止播放').setStyle(ButtonStyle.Danger),
    );

    const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (sent) ctx.interactionHandler.bindErrorPrompt(sessionId, { messageId: sent.id, channelId: channel.id });
    return sent;
  }

  async function refreshNowPlaying(player, status = 'playing') { return sendOrEditNowPlaying(player, { status }); }
  async function handleTrackStart(player, track) { return sendOrEditNowPlaying(player, { status: 'playing', forceNew: true }); }
  async function handleTrackPaused(player) { return sendOrEditNowPlaying(player, { status: 'paused' }); }
  async function handleTrackStopped(player) { return markStopped(player); }

  return {
    buildNowPlayingEmbed, buildQueueEmbed, getMainComponents, sendOrEditNowPlaying,
    sendQueuePanel, updateQueuePanel, showErrorPrompt, refreshNowPlaying,
    handleTrackStart, handleTrackPaused, handleTrackStopped,
  };
}
module.exports = createPanelManager;