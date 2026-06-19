const { sendHelpMenu } = require('../../utils/helpUtil');

module.exports = {
  name: 'help',
  description: '查看白雲所有的回文指令與斜線指令',
  aliases: ['h', '幫助'],
  async execute(message, args, client) {
    const prefix = process.env.PREFIX || '>';
    await sendHelpMenu(client, message, prefix);
  }
};
