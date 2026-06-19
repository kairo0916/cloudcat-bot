const { SlashCommandBuilder } = require('discord.js');
const { sendHelpMenu } = require('../../utils/helpUtil');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('幫助')
    .setDescription('查看白雲所有指令的詳細說明清單'),
  async execute(interaction, client) {
    const prefix = process.env.PREFIX || '>';
    await sendHelpMenu(client, interaction, prefix);
  }
};
