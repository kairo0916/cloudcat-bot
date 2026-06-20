const logger = require('./logger');
const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const musicConfig = require('../config/music');
const { attachMusicMeta, formatDuration, normalizeTrackAuthor, normalizeTrackDuration, normalizeTrackTitle, truncate } = require('./shared');

function createSearchManager(ctx) {
  function buildSearchEmbed(query, tracks) {
    const lines = tracks.map((track, index) => `${index + 1}. ${truncate(normalizeTrackTitle(track), 60)} • ${formatDuration(normalizeTrackDuration(track))} • ${truncate(normalizeTrackAuthor(track), 40)}`);
    return new EmbedBuilder().setColor(0x8B7AFF).setTitle('🔎 搜尋結果').setDescription([`查詢：\`${truncate(query, 80)}\``, '', ...lines, '', '請在 30 秒內選擇一首歌曲。'].join('\n')).setFooter({ text: 'SoundCloud 優先，找不到會嘗試 YouTube' }).setTimestamp();
  }

  async function trySearch(player, query, requester) {
    const trimmed = String(query || '').trim();
    if (!trimmed) throw new Error('請輸入歌曲名稱或連結');
    const urlLike = /^https?:\/\//i.test(trimmed);
    let result;
    try {
      if (urlLike) {
        result = await player.search(trimmed, requester);
      } else {
        result = await player.search({ query: trimmed, source: 'soundcloud' }, requester);
        if (!result || !result.tracks || result.tracks.length === 0) {
          try { result = await player.search({ query: trimmed, source: 'ytsearch' }, requester); } catch (e) { logger.warn({ emoji: '⚠️', title: 'YouTube 搜尋被拒', details: '節點未開啟 YouTube 支援' }); }
        }
      }
    } catch (err) { throw new Error('節點解析失敗，請確認該節點是否支援此平台。'); }
    return result;
  }

  async function searchAndPrompt(interaction, query) {
    await interaction.deferReply();
    const player = await ctx.voiceManager.getOrCreatePlayer(interaction);
    const startTs = Date.now();
    
    let result;
    try { result = await trySearch(player, query, interaction.user); } 
    catch (e) { return interaction.editReply({ content: `搜尋發生錯誤: ${e.message}`, embeds: [], components: [] }); }

    logger.debug({ emoji: '🔍', title: '搜尋歌曲', guild: interaction.guild?.name, user: interaction.user.tag, details: `查詢：${query}\n結果：${result?.tracks?.length || 0} 首\n耗時：${Date.now() - startTs}ms` });

    if (!result || !result.tracks || result.tracks.length === 0) {
      return interaction.editReply({ content: '❌ **找不到歌曲**\n可能節點不支援該平台或 YouTube，請嘗試其他網址。', embeds: [], components: [] });
    }

    const urlLike = /^https?:\/\//i.test(String(query).trim());
    if (urlLike || result.loadType === 'playlist') {
      const tracksToAdd = result.tracks.map(track => attachMusicMeta(ctx.manager.utils.buildTrack(track, interaction.user), { requesterId: interaction.user.id, requesterTag: interaction.user.tag, origin: 'play', counted: false, addedAt: new Date().toISOString() }));
      try {
        // 🚀 核心修復：先紀錄玩家原本是不是閒置的
        const wasIdle = !player.playing && !player.paused && !player.queue.current;
        
        await ctx.queueManager.addTracks(player, tracksToAdd, interaction.user, 'play');
        await ctx.queueManager.startIfIdle(player);
        await ctx.playerManager.touchPlaybackState(player, { state: { voiceChannelId: player.voiceChannelId, textChannelId: interaction.channelId, panelChannelId: interaction.channelId } });
        
        // 如果原本已經有歌在播，我們才手動刷新舊面板；如果是新點的歌，交給 index.js 發新面板就好！
        if (!wasIdle) {
          await ctx.panelManager.refreshNowPlaying(player).catch(() => {});
        }
        
        const titleMsg = result.playlist ? `播放清單: ${result.playlist.name} (共 ${tracksToAdd.length} 首)` : `歌曲: ${tracksToAdd[0].info.title}`;
        return interaction.editReply({ content: `✅ 已直接加入：**${titleMsg}**`, embeds: [], components: [] });
      } catch (err) { return interaction.editReply({ content: `加入佇列失敗：${err.message}`, embeds: [], components: [] }); }
    }

    const tracks = result.tracks.slice(0, 10).map(track => attachMusicMeta(ctx.manager.utils.buildTrack(track, interaction.user), { requesterId: interaction.user.id, requesterTag: interaction.user.tag, origin: 'play', counted: false, addedAt: new Date().toISOString() }));
    const sessionId = ctx.interactionHandler.registerSearchSession({ guildId: interaction.guildId, userId: interaction.user.id, channelId: interaction.channelId, messageId: null, query: String(query || '').trim(), tracks, playerGuildId: player.guildId, expiresAt: Date.now() + musicConfig.searchTimeoutMs });
    const select = new StringSelectMenuBuilder().setCustomId(`music:search:${sessionId}`).setPlaceholder('選擇一首歌曲').addOptions(tracks.map((track, index) => new StringSelectMenuOptionBuilder().setLabel(truncate(normalizeTrackTitle(track), 95)).setDescription(truncate(`${formatDuration(normalizeTrackDuration(track))} • ${normalizeTrackAuthor(track)}`, 95)).setValue(String(index))));
    const row = new ActionRowBuilder().addComponents(select);
    const message = await interaction.editReply({ embeds: [buildSearchEmbed(query, tracks)], components: [row] });
    ctx.interactionHandler.bindSearchSession(sessionId, { messageId: message?.id || null });
    return message;
  }

  return { searchAndPrompt, trySearch, buildSearchEmbed };
}
module.exports = createSearchManager;