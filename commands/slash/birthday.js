const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const gameData = require('../../utils/gameData.js');
const { loadDocument, saveDocument } = require('../../utils/mongodb');

async function loadConfig(guildId) {
  const doc = await loadDocument('system_configs', 'birthday_config');
  const configs = doc || {};
  return configs[guildId] || { enabled: false, channelId: null };
}

async function saveConfig(guildId, config) {
  let configs = await loadDocument('system_configs', 'birthday_config') || {};
  if (configs._id) delete configs._id;
  configs[guildId] = config;
  await saveDocument('system_configs', 'birthday_config', configs);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('生日')
    .setDescription('管理你的生日資訊或伺服器生日提醒')
    .addSubcommand(sub => sub.setName('設定').setDescription('設定你的生日')
      .addIntegerOption(opt => opt.setName('月').setDescription('月份 (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
      .addIntegerOption(opt => opt.setName('日').setDescription('日期 (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
    )
    .addSubcommand(sub => sub.setName('查詢').setDescription('查看你設定的生日'))
    .addSubcommand(sub => sub.setName('頻道設定').setDescription('設定生日祝福發送的頻道 (管理員專用)')
      .addChannelOption(opt => opt.setName('頻道').setDescription('選擇頻道').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('提醒開關').setDescription('開啟或關閉本伺服器的生日提醒 (管理員專用)')
      .addStringOption(opt => opt.setName('開關').setDescription('選擇狀態').setRequired(true).addChoices(
        { name: '開啟', value: 'on' },
        { name: '關閉', value: 'off' }
      ))
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const subCommand = interaction.options.getSubcommand();

    if (subCommand === '設定') {
      const month = interaction.options.getInteger('月');
      const day = interaction.options.getInteger('日');
      
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (day > daysInMonth[month - 1]) {
        return interaction.editReply({ 
          content: `❌ ${month}月沒有${day}日`
        });
      }

      const birthDate = `${month}/${day}`;
      await gameData.setBirthday(userId, birthDate);

      const embed = new EmbedBuilder()
        .setTitle('🎂 生日已設定')
        .setDescription(`你的生日：**${month}月${day}日**\n\n當你的生日到來時，我會給你送上祝福和禮物！🎁`)
        .setColor(0xf39c12)
        .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

      return interaction.editReply({ embeds: [embed] });
    }

    if (subCommand === '查詢') {
      const birthday = await gameData.getBirthday(userId);

      if (!birthday) {
        return interaction.editReply({
          content: '❌ 你還沒設定生日\n使用 `/生日 設定` 來設定你的生日'
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎂 我的生日')
        .setDescription(`**${birthday}**`)
        .setColor(0xf39c12)
        .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

      return interaction.editReply({ embeds: [embed] });
    }

    // 管理員指令
    if (subCommand === '頻道設定' || subCommand === '提醒開關') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply({ content: '❌ 你需要「管理伺服器」權限才能執行此指令。' });
      }

      const config = await loadConfig(guildId);

      if (subCommand === '頻道設定') {
        const channel = interaction.options.getChannel('頻道');
        config.channelId = channel.id;
        await saveConfig(guildId, config);
        return interaction.editReply({ content: `✅ 生日提醒頻道已設定為：<#${channel.id}>` });
      }

      if (subCommand === '提醒開關') {
        const state = interaction.options.getString('開關');
        config.enabled = (state === 'on');
        await saveConfig(guildId, config);
        return interaction.editReply({ content: `✅ 生日提醒功能已 **${config.enabled ? '開啟' : '關閉'}**` });
      }
    }
  }
};
