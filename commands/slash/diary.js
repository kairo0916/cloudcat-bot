const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { getCollection } = require('../../utils/mongodb');
const { exportConversation } = require('../../utils/aiFeatures');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('日記')
    .setDescription('白雲記憶館 - 查看與匯出你的心情點滴')
    .addSubcommand(sub => sub.setName('寫日記').setDescription('AI 輔助撰寫個人日記'))
    .addSubcommand(sub => sub.setName('查看').setDescription('查看之前撰寫的日記'))
    .addSubcommand(sub => sub.setName('匯出').setDescription('將對話記錄匯出為文件')),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === '寫日記') {
      const modal = new ModalBuilder().setCustomId(`diary_${userId}_${Date.now()}`).setTitle('📝 AI 日記助手');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('diary_topic').setLabel('主題').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('diary_words').setLabel('字數 (100-2000)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('diary_details').setLabel('細節').setStyle(TextInputStyle.Paragraph).setRequired(false))
      );
      return await interaction.showModal(modal);
    }

    if (sub === '查看') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const col = await getCollection('user_diaries');
      const diaries = await col.find({ userId }).sort({ created: -1 }).limit(10).toArray();
      if (diaries.length === 0) return interaction.editReply('❌ 你目前還沒有任何日記記錄。');
      const embed = new EmbedBuilder().setTitle('📚 我的日記集').setColor(0x3498db)
        .setDescription(diaries.map(d => `**📅 ${new Date(d.created).toLocaleDateString('zh-TW')}** - ${d.topic}`).join('\n'));
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === '匯出') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const content = await exportConversation(userId, 'txt');
      if (!content) return interaction.editReply('❌ 沒有對話記錄可供匯出。');
      const buffer = Buffer.from(content, 'utf-8');
      return interaction.editReply({ content: '✨ 匯出成功！', files: [{ attachment: buffer, name: `memory_${userId}.txt` }] });
    }
  }
};
