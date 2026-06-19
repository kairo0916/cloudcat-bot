const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const gameData = require('../../utils/gameData.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('寶物收藏')
    .setDescription('查看你收集的所有寶物'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const items = await gameData.getItems(userId);

    if (items.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📦 寶物收藏')
        .setDescription('你還沒有收集任何寶物呢！\n去 `/商店` 購買一些吧！')
        .setColor(0x95a5a6)
        .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

      return interaction.editReply({ embeds: [embed] });
    }

    // 按物品名稱分類計數
    const itemCounts = {};
    items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    });

    let description = '';
    Object.entries(itemCounts).forEach(([name, count]) => {
      description += `• ${name} x${count}\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('📦 我的寶物收藏')
      .setDescription(description)
      .addFields(
        { name: '總計', value: `${items.length} 件物品`, inline: false }
      )
      .setColor(0xe74c3c)
      .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

    return interaction.editReply({ embeds: [embed] });
  }
};
