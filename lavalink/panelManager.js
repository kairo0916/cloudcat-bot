const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const musicConfig = require('../config/music');
const storage = require('./storage');
const {
  clamp,
  formatDuration,
  normalizeTrackAuthor,
  normalizeTrackDuration,
  normalizeTrackTitle,
  truncate,
  getRequesterId,
} = require('./shared');

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
    const title = current ? normalizeTrackTitle(current) : '沒有正在播放的歌曲';
    const author = current ? normalizeTrackAuthor(current) : 'Unknown artist';
    const requester = current?.musicMeta?.requesterTag || current?.requester?.tag || current?.requester?.username || 'Unknown';
    const duration = current ? formatDuration(normalizeTrackDuration(current)) : '00:00';

    const embed = new EmbedBuilder()
      .setColor(status === 'paused' ? 0xF1C40F : status === 'stopped' ? 0xED4245 : 0x57F287)
      .setTitle(`${status === 'paused' ? '⏸️ 已暫停' : status === 'stopped' ? '🛑 已停止' : '✅ 正在播放'} ${truncate(title, 80)}`)
      .setDescription([
        `👤 作者: ${truncate(author, 80)}`,
        `👤 點播者: ${truncate(requester, 80)}`,
        `🎵 歌曲長度: ${duration}`,
        `📜 隊列: ${queueSize}`,
      ].join('\n'))
      .setFooter({ text: buildFooter(player, state) })
      .setTimestamp();

    const artwork = current?.info?.artworkUrl || current?.info?.thumbnail || current?.thumbnail;
    if (artwork) embed.setThumbnail(artwork);
    return embed;
  }

  async function getMainComponents(player) {
    const current = player?.queue?.current;
    const paused = Boolean(player?.paused);
    const repeatMode = player?.repeatMode || 'off';
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const shuffleEnabled = Boolean(state?.settings?.shuffleEnabled);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music:panel:playpause')
        .setLabel(paused ? '▶️ 播放' : '⏸️ 暫停')
        .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music:panel:prev')
        .setLabel('⏮️ 上一首')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!player?.queue?.previous?.length),
      new ButtonBuilder()
        .setCustomId('music:panel:next')
        .setLabel('⏭️ 下一首')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!current && !player?.queue?.tracks?.length),
      new ButtonBuilder()
        .setCustomId('music:panel:loop')
        .setLabel(`🔁 ${repeatMode === 'track' ? '單曲' : repeatMode === 'queue' ? '隊列' : '循環'}`)
        .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music:panel:shuffle')
        .setLabel(shuffleEnabled ? '🔀 交錯 on' : '🔀 交錯 off')
        .setStyle(shuffleEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled((player?.queue?.tracks?.length || 0) < 2),
      new ButtonBuilder()
        .setCustomId('music:panel:queue')
        .setLabel('📜 隊列')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music:panel:stop')
        .setLabel('🛑 停止')
        .setStyle(ButtonStyle.Danger),
    );

    return [row1, row2];
  }

  async function resolveTextChannel(player) {
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const channelId = state?.state?.textChannelId || player.textChannelId || state?.state?.panelChannelId;
    if (!channelId) return null;
    return ctx.client.channels.fetch(channelId).catch(() => null);
  }

  async function resolvePanelMessage(player, channel) {
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const messageId = state?.state?.panelMessageId;
    if (!messageId || !channel?.messages?.fetch) return null;
    return channel.messages.fetch(messageId).catch(() => null);
  }

  async function savePanelRefs(player, channelId, messageId) {
    await ctx.playerManager.updatePanelRefs(player.guildId, {
      panelChannelId: channelId,
      panelMessageId: messageId,
      textChannelId: channelId,
    });
  }

  async function sendOrEditNowPlaying(player, { status = 'playing', forceNew = false } = {}) {
    if (!player) return null;
    const channel = await resolveTextChannel(player);
    if (!channel || !channel.isTextBased()) return null;

    const state = await ctx.playerManager.getGuildState(player.guildId);
    const embed = buildNowPlayingEmbed(player, state, status);
    const components = await getMainComponents(player);
    const payload = { embeds: [embed], components };

    let message = null;
    if (!forceNew) {
      message = await resolvePanelMessage(player, channel);
    }

    if (message) {
      try {
        await message.edit(payload);
        return message;
      } catch (err) {
        message = null;
      }
    }

    const sent = await channel.send(payload).catch(() => null);
    if (sent) {
      await savePanelRefs(player, channel.id, sent.id).catch(() => {});
    }
    return sent;
  }

  async function markStopped(player) {
    if (!player) return;
    const channel = await resolveTextChannel(player);
    if (!channel || !channel.isTextBased()) return;
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const embed = buildNowPlayingEmbed(player, state, 'stopped');
    const sent = await channel.send({ embeds: [embed], components: [] }).catch(() => null);
    if (sent) {
      await savePanelRefs(player, channel.id, sent.id).catch(() => {});
    }
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
    if (current) {
      lines.push(`**正在播放** ${truncate(normalizeTrackTitle(current), 60)} • ${formatDuration(normalizeTrackDuration(current))}`);
    }
    if (pageTracks.length === 0) {
      lines.push('沒有更多歌曲。');
    } else {
      pageTracks.forEach((track, index) => {
        const n = start + index + 1;
        lines.push(`${n}. ${truncate(normalizeTrackTitle(track), 58)} • ${formatDuration(normalizeTrackDuration(track))}`);
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📜 隊列清單 第 ${safePage} / ${pages} 頁`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `共 ${tracks.length} 首 | ${buildFooter(player, state)}` })
      .setTimestamp();

    return { embed, pages, safePage };
  }

  async function sendQueuePanel(player, page = 1, userId = null) {
    const channel = await resolveTextChannel(player);
    if (!channel || !channel.isTextBased()) return null;
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const { embed, pages, safePage } = buildQueueEmbed(player, state, page);
    const sessionId = ctx.interactionHandler.registerQueueSession({
      guildId: player.guildId,
      userId,
      channelId: channel.id,
      messageId: null,
      page: safePage,
      pages,
      expiresAt: Date.now() + musicConfig.searchTimeoutMs,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`music:queue:${sessionId}:prev`)
        .setLabel('◀ 上一頁')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage <= 1),
      new ButtonBuilder()
        .setCustomId(`music:queue:${sessionId}:next`)
        .setLabel('下一頁 ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage >= pages),
      new ButtonBuilder()
        .setCustomId(`music:queue:${sessionId}:close`)
        .setLabel('關閉')
        .setStyle(ButtonStyle.Danger),
    );

    const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (sent) {
      ctx.interactionHandler.bindQueueSession(sessionId, { messageId: sent.id });
    }
    return sent;
  }

  async function updateQueuePanel(interaction, session, page) {
    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!player) return interaction.update({ content: '播放器不存在。', components: [], embeds: [] });
    const state = await ctx.playerManager.getGuildState(player.guildId);
    const { embed, pages, safePage } = buildQueueEmbed(player, state, page);
    session.page = safePage;
    session.pages = pages;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`music:queue:${session.id}:prev`)
        .setLabel('◀ 上一頁')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage <= 1),
      new ButtonBuilder()
        .setCustomId(`music:queue:${session.id}:next`)
        .setLabel('下一頁 ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage >= pages),
      new ButtonBuilder()
        .setCustomId(`music:queue:${session.id}:close`)
        .setLabel('關閉')
        .setStyle(ButtonStyle.Danger),
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  async function showErrorPrompt(player, track, reason) {
    const channel = await resolveTextChannel(player);
    if (!channel || !channel.isTextBased()) return null;
    const sessionId = ctx.interactionHandler.registerErrorPrompt({
      guildId: player.guildId,
      channelId: channel.id,
      playerGuildId: player.guildId,
      trackKey: track?.musicMeta?.requestId || track?.info?.identifier || null,
      expiresAt: Date.now() + 30_000,
    });

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('⚠️ 歌曲無法播放')
      .setDescription([
        `歌曲：${truncate(normalizeTrackTitle(track), 80)}`,
        `原因：${truncate(reason?.message || String(reason || 'Unknown error'), 500)}`,
        '',
        '要保留播放器與隊列嗎？',
      ].join('\n'))
      .setFooter({ text: '30 秒內未操作將自動忽略' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`music:error:${sessionId}:keep`)
        .setLabel('保留播放器')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`music:error:${sessionId}:stop`)
        .setLabel('停止播放')
        .setStyle(ButtonStyle.Danger),
    );

    const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (sent) {
      ctx.interactionHandler.bindErrorPrompt(sessionId, {
        messageId: sent.id,
        channelId: channel.id,
      });
    }
    return sent;
  }

  async function refreshNowPlaying(player, status = 'playing') {
    return sendOrEditNowPlaying(player, { status });
  }

  async function handleTrackStart(player, track) {
    return sendOrEditNowPlaying(player, { status: 'playing' });
  }

  async function handleTrackPaused(player) {
    return sendOrEditNowPlaying(player, { status: 'paused' });
  }

  async function handleTrackStopped(player) {
    await markStopped(player);
    if (player?.guildId) {
      await ctx.playerManager.clearPanelRefs(player.guildId).catch(() => {});
    }
  }

  return {
    buildNowPlayingEmbed,
    buildQueueEmbed,
    getMainComponents,
    sendOrEditNowPlaying,
    sendQueuePanel,
    updateQueuePanel,
    showErrorPrompt,
    refreshNowPlaying,
    handleTrackStart,
    handleTrackPaused,
    handleTrackStopped,
  };
}

module.exports = createPanelManager;
