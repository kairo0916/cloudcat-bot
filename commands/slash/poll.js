const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('投票')
    .setDescription('舉辦一個伺服器投票活動')
    .addStringOption(opt => opt.setName('問題').setDescription('投票的問題是什麼？').setRequired(true))
    .addStringOption(opt => opt.setName('選項1').setDescription('選項 1').setRequired(true))
    .addStringOption(opt => opt.setName('選項2').setDescription('選項 2').setRequired(true))
    .addStringOption(opt => opt.setName('選項3').setDescription('選項 3').setRequired(false))
    .addStringOption(opt => opt.setName('選項4').setDescription('選項 4').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('問題');
    const options = [
      interaction.options.getString('選項1'),
      interaction.options.getString('選項2'),
      interaction.options.getString('選項3'),
      interaction.options.getString('選項4')
    ].filter(Boolean);

    const votes = new Array(options.length).fill(0);
    const voters = new Set();

    const generateEmbed = () => {
      const totalVotes = votes.reduce((a, b) => a + b, 0);
      let desc = '';

      options.forEach((opt, idx) => {
        const percentage = totalVotes === 0 ? 0 : Math.round((votes[idx] / totalVotes) * 100);
        const blocks = Math.round(percentage / 10);
        const bar = '🟩'.repeat(blocks) + '⬛'.repeat(10 - blocks);
        desc += `**${idx + 1}. ${opt}**\n${bar} ${percentage}% (${votes[idx]} 票)\n\n`;
      });

      return new EmbedBuilder()
        .setTitle(`📊 投票：${question}`)
        .setDescription(desc)
        .setColor(0x3498DB)
        .setFooter({ text: `總投票數: ${totalVotes} | ${process.env.FOOTER}`, iconURL: interaction.user.displayAvatarURL() });
    };

    const row = new ActionRowBuilder();
    options.forEach((opt, idx) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_opt_${idx}`)
          .setLabel(opt.length > 20 ? opt.slice(0, 17) + '...' : opt)
          .setStyle(ButtonStyle.Primary)
      );
    });

    const message = await interaction.reply({
      embeds: [generateEmbed()],
      components: [row],
      fetchReply: true
    });

    const collector = message.createMessageComponentCollector({ time: 86400000 }); // 24小時

    collector.on('collect', async i => {
      if (voters.has(i.user.id)) {
        return i.reply({ content: '❌ 你已經投過票了！', flags: MessageFlags.Ephemeral });
      }

      const optIndex = parseInt(i.customId.replace('poll_opt_', ''));
      if (!isNaN(optIndex)) {
        votes[optIndex]++;
        voters.add(i.user.id);
        
        await i.update({
          embeds: [generateEmbed()]
        });
      }
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder();
      options.forEach((opt, idx) => {
        disabledRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_opt_disabled_${idx}`)
            .setLabel(opt.length > 20 ? opt.slice(0, 17) + '...' : opt)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      });
      await message.edit({ content: '🔒 投票已結束', components: [disabledRow] }).catch(() => {});
    });
  }
};