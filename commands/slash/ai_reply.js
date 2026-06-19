const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('AI 回覆')
    .setType(ApplicationCommandType.Message),
  async execute(interaction, client) {
    await interaction.deferReply();
    const message = interaction.targetMessage;
    const content = message.content || '(無文字內容)';
    
    // 如果被選取的訊息有圖片，也進行識別
    let imageDesc = '';
    if (message.attachments.size > 0) {
       const att = message.attachments.first();
       if (att.contentType?.startsWith('image/')) {
           imageDesc = await client.analyzeImageWithGemini(att.url);
       }
    }

    const finalContent = imageDesc ? `[被選取的訊息包含圖片]\n圖片描述：${imageDesc}\n\n文字內容：${content}` : `[被選取的訊息內容]：\n${content}`;

    const user = {
      id: interaction.user.id,
      username: interaction.user.username,
      globalName: interaction.user.globalName,
      displayName: interaction.member?.displayName
    };

    // 不將這個「右鍵回覆」的歷史記錄寫入個人記憶檔案中 (saveMemory = false)
    const reply = await client.aiChat(user, finalContent, '請針對這段被選取的訊息給出你的回覆或看法', [], false);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: `回覆 ${message.author.tag} 的訊息`, iconURL: message.author.displayAvatarURL() })
      .setDescription(`> ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}\n\n**AI 的看法：**\n${reply}`)
      .setFooter({ text: '右鍵應用程式 AI 回覆' });

    await interaction.editReply({ embeds: [embed] });
  }
};