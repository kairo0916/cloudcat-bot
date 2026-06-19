const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const musicConfig = require('../../../config/music');
const { formatDuration, normalizeTrackTitle, normalizeTrackAuthor, normalizeTrackDuration, truncate } = require('../../../lavalink/shared');

function buildAchievementTitle(playCount) {
  if (playCount >= 10000) return '骨灰級音樂家';
  if (playCount >= 1000) return '終極音樂家';
  if (playCount >= 100) return '中級音樂家';
  if (playCount >= 10) return '見習音樂家';
  return '尚未獲得稱號';
}

function buildHistoryEmbed(player, page = 1) {
  const history = [...(player?.queue?.previous || [])];
  const perPage = 10;
  const pages = Math.max(1, Math.ceil(history.length / perPage));
  const safePage = Math.max(1, Math.min(page, pages));
  const start = (safePage - 1) * perPage;
  const items = history.slice(start, start + perPage);

  const desc = items.length
    ? items.map((track, index) => `${start + index + 1}. ${truncate(normalizeTrackTitle(track), 60)} • ${formatDuration(normalizeTrackDuration(track))}`).join('\n')
    : '目前沒有歷史紀錄。';

  return new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle(`📚 播放歷史 第 ${safePage} / ${pages} 頁`)
    .setDescription(desc)
    .setFooter({ text: `共 ${history.length} 首` })
    .setTimestamp();
}

function buildLeaderboardEmbed(type, docs, client) {
  let title = '排行榜';
  let lines = [];

  if (type === 'user') {
    title = '🎧 最常點歌使用者';
    lines = docs.map((doc, index) => `${index + 1}. <@${doc._id}> - ${doc.requestCount || 0} 次`);
  } else if (type === 'track') {
    title = '🎵 最常播放歌曲';
    lines = docs.map((doc, index) => `${index + 1}. ${truncate(doc.title || 'Unknown', 60)} • ${doc.playCount || 0} 次`);
  } else if (type === 'guild') {
    title = '🏠 最活躍伺服器';
    lines = docs.map((doc, index) => {
      const guildName = client.guilds.cache.get(doc._id)?.name || doc.guildId || doc._id;
      return `${index + 1}. ${truncate(guildName, 50)} - ${doc.stats?.playCount || 0} 次`;
    });
  }

  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(title)
    .setDescription(lines.length ? lines.join('\n') : '尚無資料。')
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('音樂')
    .setDescription('Discord 音樂系統')
    .addSubcommand(sub =>
      sub
        .setName('播放')
        .setDescription('搜尋並播放歌曲')
        .addStringOption(opt =>
          opt.setName('歌曲')
            .setDescription('YouTube URL / 關鍵字 / SoundCloud 關鍵字')
            .setRequired(true)))
    .addSubcommand(sub => sub.setName('暫停').setDescription('暫停播放器'))
    .addSubcommand(sub => sub.setName('繼續').setDescription('繼續播放'))
    .addSubcommand(sub => sub.setName('下一首').setDescription('跳過到下一首'))
    .addSubcommand(sub => sub.setName('上一首').setDescription('播放上一首'))
    .addSubcommand(sub => sub.setName('停止').setDescription('停止播放並清空佇列'))
    .addSubcommand(sub => sub.setName('加入').setDescription('強制加入目前播放的語音頻道'))
    .addSubcommand(sub => sub.setName('離開').setDescription('離開語音頻道'))
    .addSubcommand(sub =>
      sub
        .setName('音量')
        .setDescription('調整音量')
        .addIntegerOption(opt =>
          opt.setName('數值')
            .setDescription('1 - 100')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)))
    .addSubcommand(sub =>
      sub
        .setName('循環')
        .setDescription('切換循環模式')
        .addStringOption(opt =>
          opt.setName('模式')
            .setDescription('循環模式')
            .setRequired(true)
            .addChoices(
              { name: '關閉', value: 'off' },
              { name: '單曲', value: 'track' },
              { name: '隊列', value: 'queue' },
            )))
    .addSubcommand(sub => sub.setName('交錯').setDescription('切換交錯模式'))
    .addSubcommand(sub =>
      sub
        .setName('隊列')
        .setDescription('顯示目前播放佇列')
        .addIntegerOption(opt =>
          opt.setName('頁數')
            .setDescription('頁數')
            .setMinValue(1)
            .setRequired(false)))
    .addSubcommand(sub =>
      sub
        .setName('歷史')
        .setDescription('顯示播放歷史')
        .addIntegerOption(opt =>
          opt.setName('頁數')
            .setDescription('頁數')
            .setMinValue(1)
            .setRequired(false)))
    .addSubcommand(sub =>
      sub
        .setName('排行榜')
        .setDescription('查看音樂排行榜')
        .addStringOption(opt =>
          opt.setName('類型')
            .setDescription('排行榜類型')
            .setRequired(true)
            .addChoices(
              { name: '最常點歌使用者', value: 'user' },
              { name: '最常播放歌曲', value: 'track' },
              { name: '最活躍伺服器', value: 'guild' },
            )))
    .addSubcommand(sub => sub.setName('成就').setDescription('查看你的音樂稱號')),

  async execute(interaction) {
    const music = interaction.client.music;
    if (!music?.enabled) {
      return interaction.reply({ content: '音樂系統目前未啟用。', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    try {
      if (sub === '播放') {
        const query = interaction.options.getString('歌曲', true);
        return music.searchManager.searchAndPrompt(interaction, query);
      }

      if (sub === '加入') {
        const player = await music.voiceManager.joinCurrentChannel(interaction);
        await interaction.reply({ content: `已加入 <#${player.voiceChannelId}>。`, flags: MessageFlags.Ephemeral });
        return;
      }

      if (sub === '離開') {
        await music.voiceManager.leavePlayer(interaction, { announce: false, clearQueue: false });
        await interaction.reply({ content: '已離開語音頻道。', flags: MessageFlags.Ephemeral });
        return;
      }

      const player = music.playerManager.getPlayer(interaction.guildId);

      if (sub === '暫停') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        await music.playerManager.pause(player);
        await music.panelManager.sendOrEditNowPlaying(player, { status: 'paused' });
        return interaction.reply({ content: '已暫停。', flags: MessageFlags.Ephemeral });
      }

      if (sub === '繼續') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        await music.playerManager.resume(player);
        await music.panelManager.sendOrEditNowPlaying(player, { status: 'playing' });
        return interaction.reply({ content: '已繼續播放。', flags: MessageFlags.Ephemeral });
      }

      if (sub === '下一首') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        await music.queueManager.skipNext(player, 1);
        return interaction.reply({ content: '已跳過到下一首。', flags: MessageFlags.Ephemeral });
      }

      if (sub === '上一首') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        await music.queueManager.playPrevious(player);
        await music.panelManager.sendOrEditNowPlaying(player, { status: 'playing' });
        return interaction.reply({ content: '已播放上一首。', flags: MessageFlags.Ephemeral });
      }

      if (sub === '停止') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        await music.queueManager.clearQueueAndHistory(player);
        await music.playerManager.destroy(player, 'manual-stop', { clearState: true, clearQueue: false });
        await music.panelManager.handleTrackStopped(player);
        return interaction.reply({ content: '已停止並清空佇列。', flags: MessageFlags.Ephemeral });
      }

      if (sub === '音量') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        const volume = interaction.options.getInteger('數值', true);
        await music.playerManager.setVolume(player, volume);
        await music.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' });
        return interaction.reply({ content: `音量已設定為 ${volume}%。`, flags: MessageFlags.Ephemeral });
      }

      if (sub === '循環') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        const mode = interaction.options.getString('模式', true);
        await music.queueManager.setLoopMode(player, mode);
        await music.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' });
        return interaction.reply({ content: `循環模式已切換為 ${mode}。`, flags: MessageFlags.Ephemeral });
      }

      if (sub === '交錯') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        const enabled = await music.queueManager.toggleShuffle(player);
        await music.panelManager.sendOrEditNowPlaying(player, { status: player.paused ? 'paused' : 'playing' });
        return interaction.reply({ content: `交錯模式已${enabled ? '啟用' : '關閉'}。`, flags: MessageFlags.Ephemeral });
      }

      if (sub === '隊列') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        const page = interaction.options.getInteger('頁數') || 1;
        await music.panelManager.sendQueuePanel(player, page, interaction.user.id);
        return interaction.reply({ content: '已開啟隊列視窗。', flags: MessageFlags.Ephemeral });
      }

      if (sub === '歷史') {
        if (!player) return interaction.reply({ content: '目前沒有播放器。', flags: MessageFlags.Ephemeral });
        const page = interaction.options.getInteger('頁數') || 1;
        const embed = buildHistoryEmbed(player, page);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (sub === '排行榜') {
        const type = interaction.options.getString('類型', true);
        let docs = [];
        if (type === 'user') docs = await music.queueManager.getTopRequestedUsers(10);
        if (type === 'track') docs = await music.queueManager.getTopTracks(10);
        if (type === 'guild') docs = await music.queueManager.getTopGuilds(10);
        const embed = buildLeaderboardEmbed(type, docs, interaction.client);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (sub === '成就') {
        const userDoc = await music.storage.loadDocument('music_users', interaction.user.id) || {
          playCount: 0,
          requestCount: 0,
          title: null,
        };
        const title = userDoc.title || buildAchievementTitle(userDoc.playCount || 0);
        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(`🎖️ ${interaction.user.username} 的音樂稱號`)
          .setDescription([
            `成功播放次數：${userDoc.playCount || 0}`,
            `點歌次數：${userDoc.requestCount || 0}`,
            `稱號：${title}`,
          ].join('\n'))
          .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch (err) {
      return interaction.reply({ content: err.message || String(err), flags: MessageFlags.Ephemeral });
    }
  },
};
