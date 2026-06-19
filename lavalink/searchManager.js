const {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const musicConfig = require('../config/music');
const {
  attachMusicMeta,
  formatDuration,
  normalizeTrackAuthor,
  normalizeTrackDuration,
  normalizeTrackTitle,
  truncate,
} = require('./shared');

function createSearchManager(ctx) {
  function buildSearchEmbed(query, tracks) {
    const lines = tracks.map((track, index) => {
      const title = truncate(normalizeTrackTitle(track), 60);
      const author = truncate(normalizeTrackAuthor(track), 40);
      return `${index + 1}. ${title} • ${formatDuration(normalizeTrackDuration(track))} • ${author}`;
    });

    return new EmbedBuilder()
      .setColor(0x8B7AFF)
      .setTitle('🔎 搜尋結果')
      .setDescription([
        `查詢：\`${truncate(query, 80)}\``,
        '',
        ...lines,
        '',
        '請在 30 秒內選擇一首歌曲。'
      ].join('\n'))
      .setFooter({ text: 'SoundCloud 優先，找不到會嘗試 YouTube' })
      .setTimestamp();
  }

  async function trySearch(player, query, requester) {
    const trimmed = String(query || '').trim();
    if (!trimmed) throw new Error('請輸入歌曲名稱或連結');

    const urlLike = /^https?:\/\//i.test(trimmed);
    const isSoundCloudSource = !urlLike;

    const attempts = [];
    if (urlLike) {
      attempts.push(async () => player.search(trimmed, requester, false));
    } else {
      attempts.push(async () => player.search({ query: trimmed, source: 'soundcloud' }, requester, false));
      attempts.push(async () => player.search({ query: trimmed, source: 'ytsearch' }, requester, false));
    }

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const result = await attempt();
        if (result?.tracks?.length) return result;
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError && !attempts.length) {
      throw lastError;
    }

    return null;
  }

  async function searchAndPrompt(interaction, query) {
    await interaction.deferReply();

    const player = await ctx.voiceManager.getOrCreatePlayer(interaction);
    const result = await trySearch(player, query, interaction.user);
    const tracks = (result?.tracks || []).slice(0, 10).map(track => {
      const built = ctx.manager.utils.buildTrack(track, interaction.user);
      return attachMusicMeta(built, {
        requesterId: interaction.user.id,
        requesterTag: interaction.user.tag,
        origin: 'play',
        counted: false,
        addedAt: new Date().toISOString(),
      });
    });

    if (tracks.length === 0) {
      return interaction.editReply({ content: '找不到歌曲。', embeds: [], components: [] });
    }

    const sessionId = ctx.interactionHandler.registerSearchSession({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      channelId: interaction.channelId,
      messageId: null,
      query: String(query || '').trim(),
      tracks,
      playerGuildId: player.guildId,
      expiresAt: Date.now() + musicConfig.searchTimeoutMs,
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId(`music:search:${sessionId}`)
      .setPlaceholder('選擇一首歌曲')
      .addOptions(tracks.map((track, index) => {
        const title = truncate(normalizeTrackTitle(track), 95);
        const description = truncate(`${formatDuration(normalizeTrackDuration(track))} • ${normalizeTrackAuthor(track)}`, 95);
        return new StringSelectMenuOptionBuilder()
          .setLabel(title)
          .setDescription(description)
          .setValue(String(index));
      }));

    const row = new ActionRowBuilder().addComponents(select);
    const embed = buildSearchEmbed(query, tracks);
    const message = await interaction.editReply({ embeds: [embed], components: [row] });
    ctx.interactionHandler.bindSearchSession(sessionId, {
      messageId: message?.id || null,
    });
    return message;
  }

  return {
    searchAndPrompt,
    trySearch,
    buildSearchEmbed,
  };
}

module.exports = createSearchManager;
