const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ChannelType
} = require('discord.js');
const { loadDocument, saveDocument, getCount, client: getMongoClient } = require('../../utils/mongodb');
const cohereEnhanced = require('../../utils/cohereEnhanced.js');
const gameData = require('../../utils/gameData.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('資訊')
    .setDescription('白雲資訊中心 - 查看機器人、伺服器與個人數據')
    .addSubcommand(sub => sub.setName('機器人狀態').setDescription('查看機器人的執行狀態與系統資訊'))
    .addSubcommand(sub => sub.setName('全局統計').setDescription('查看白雲在所有伺服器的累計數據'))
    .addSubcommand(sub => sub.setName('個人統計').setDescription('查看你在本伺服器的活動與遊戲數據'))
    .addSubcommand(sub => sub.setName('mc狀態').setDescription('查詢 Minecraft 伺服器即時狀態')
      .addStringOption(opt => opt.setName('伺服器ip').setDescription('要查詢的 IP 或域名').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const client = interaction.client;

    // 機器人狀態
    if (sub === '機器人狀態') {
      await interaction.deferReply();

      const buildStatusEmbed = async () => {
        const uptimeSec = Math.floor(process.uptime());
        const uptimeStr = `${Math.floor(uptimeSec / 86400)}天 ${Math.floor(uptimeSec % 86400 / 3600)}小時 ${Math.floor(uptimeSec % 3600 / 60)}分 ${uptimeSec % 60}秒`;
        
        const guilds = client.guilds.cache.size;
        const textChannels = client.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = client.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        
        const loadedSlash = client.slashCommands?.size || 0;
        const loadedText = client.textCommands?.size || 0;

        const usageDoc = await loadDocument('system_configs', 'command_usage');
        const commandUsageCount = usageDoc?.count || 0;

        const djsVersion = require('discord.js').version;

        // DB Stats
        let dbStatus = '未連接';
        let poolCurrent = '未知';
        let poolActive = '未知';
        let poolIdle = '未知';
        let memoryCount = await getCount('ai_memories');
        const banDoc = await loadDocument('system_configs', 'banlist');
        let banCount = banDoc?.data?.length || 0;

        try {
          const mongoClient = getMongoClient();
          if (mongoClient) {
            dbStatus = '已連接';
            const admin = mongoClient.db().admin();
            const serverStatus = await admin.serverStatus().catch(() => null);
            if (serverStatus?.connections) {
              poolCurrent = serverStatus.connections.current;
              poolActive = serverStatus.connections.active;
              poolIdle = serverStatus.connections.available;
            }
          }
        } catch (e) {}

        const rawBotVer = process.env.BOT_VERSION || '1.3.0';
        const botVer = rawBotVer.replace(/^v/i, '');

        const embed = new EmbedBuilder().setTitle('🤖 機器人當前狀態').setColor(0x53e64c)
          .addFields(
            { 
              name: '📊 系統概況', 
              value: `\`\`\`\n上線時長：${uptimeStr}\n延遲：${client.ws.ping}ms\nNodeJS版本：${process.version}\ndiscord.js版本：v${djsVersion}\n已載入斜線指令：${loadedSlash}\n已載入回文指令：${loadedText}\n指令總使用次數：${commandUsageCount}\n\`\`\``, 
              inline: false 
            },
            { 
              name: '💬 伺服器資訊', 
              value: `\`\`\`\n伺服器數量：${guilds}\n文字頻道：${textChannels}\n語音頻道：${voiceChannels}\n\`\`\``, 
              inline: false 
            },
            { 
              name: '💾 資料庫資訊', 
              value: `\`\`\`\n連接狀態：${dbStatus}\n連接池：${poolCurrent}\n活躍：${poolActive}\n閒置：${poolIdle}\n\n使用者記憶筆數：${memoryCount}筆\n黑名單筆數：${banCount}筆\n\`\`\``, 
              inline: false 
            },
            { 
              name: '⚙️ 版本資訊', 
              value: `\`\`\`\nBOT：v${botVer}\n\`\`\``, 
              inline: false 
            }
          )
          .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();
        
        return embed;
      };

      const embed = await buildStatusEmbed();

      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('refresh_status').setLabel('刷新狀態').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setLabel('邀請機器人').setStyle(ButtonStyle.Link).setURL(inviteUrl),
        new ButtonBuilder().setLabel('加入支援群').setStyle(ButtonStyle.Link).setURL('https://discord.gg/umKvqHj4DC')
      );

      const response = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = response.createMessageComponentCollector({
        filter: i => i.customId === 'refresh_status',
        time: 300000 // 5分鐘後過期按鈕
      });

      collector.on('collect', async i => {
        await i.deferUpdate();
        const newEmbed = await buildStatusEmbed();
        await i.editReply({ embeds: [newEmbed] }).catch(() => {});
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });

      return;
    }

    // 全局統計
    if (sub === '全局統計') {
      await interaction.deferReply();
      const stats = await cohereEnhanced.getServerStats();
      const topUsers = await cohereEnhanced.getTopUsers(5);
      let topText = topUsers.map((u, i) => `\`${i+1}\` **${u.identity}** - ${u.messageCount} 次對話`).join('\n');
      
      const embed = new EmbedBuilder().setTitle('📊 機器人全局統計資訊').setColor(0x42D9FF)
        .addFields(
          { name: '👥 累計用戶', value: `\`${stats?.totalUsers || 0}\` 人`, inline: true },
          { name: '💬 記憶總數', value: `\`${stats?.totalMemories || 0}\` 條`, inline: true },
          { name: '🏆 活躍排行榜', value: topText || '暫無數據', inline: false }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // 個人統計
    if (sub === '個人統計') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const stats = await gameData.getDataStats(interaction.user.id);
      const coins = await gameData.getCoins(interaction.user.id);
      const embed = new EmbedBuilder().setTitle('📊 個人活動統計').setColor(0x9b59b6)
        .addFields(
          { name: '💰 經濟', value: `金幣：${coins}\n成就：${stats['challenges_completed'] || 0}`, inline: true },
          { name: '🎮 遊戲', value: `2048：${stats['2048_best'] || 0}\n勝場：${(stats['rockpaper_wins'] || 0) + (stats['blackjack_wins'] || 0)}`, inline: true },
          { name: '💬 社交', value: `親密度：${stats['intimacy'] || 0}\n對話：${stats['conversations'] || 0}`, inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // MC 狀態
    if (sub === 'mc狀態') {
      await interaction.deferReply();
      const ip = interaction.options.getString('伺服器ip');
      // 此處調用 mc_status.js 的 buildEmbed 邏輯（簡化版）
      const embed = new EmbedBuilder().setTitle('☁️ MC 伺服器狀態').setDescription(`正在查詢 \`${ip}\` 的狀態...`).setColor(0x3BA9FF);
      return interaction.editReply({ content: `✅ [點此查看 ${ip} 的詳細狀態](https://mcstatus.io/status/java/${ip})`, embeds: [embed] });
    }
  }
};
