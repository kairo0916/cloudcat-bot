const path = require('path');

module.exports = {
  name: '.',
  description: '特化 AI 對話 (強制使用 Gemini 且套用 prompt2.txt 與自訂安全設定)',
  async execute(message, args, client) {
    const text = args.join(' ');
    const hasAttachment = message.attachments && message.attachments.size > 0;

    if (!text && !hasAttachment) {
      return message.reply("請輸入要對話的內容！");
    }

    // 定義此指令專用的設定 (強制使用 Gemini, 指定金鑰與提示詞)
    const customConfig = {
      promptPath: path.join(process.cwd(), 'dot', 'prompt2.txt'),
      dataDir: path.join(process.cwd(), 'dot', 'data'),
      apiKey: process.env.GEMINI_GEMINI_API_KEY,
      forceModel: 'gemini',
      asSystem: true,
      // 可自由更改的安全設定
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    const user = {
      id: message.author.id,
      username: message.author.username,
      globalName: message.author.globalName,
      displayName: message.member?.displayName
    };

    let thinkingMsg = null;
    let typingInterval = null;

    try {
      thinkingMsg = await message.reply('## 💭 思考中.. (特化模式)').catch(() => null);
      typingInterval = setInterval(() => { message.channel.sendTyping().catch(() => {}); }, 4000);
      message.channel.sendTyping().catch(() => {});

      let reply = '';
      let rawContent = text;

      // 圖片辨識邏輯 (與一般對話相同)
      if (hasAttachment) {
        const att = message.attachments.first();
        if (att.contentType?.startsWith('image/')) {
          const desc = await client.analyzeImageWithGemini(att.url);
          rawContent = rawContent 
            ? `[使用者傳送了圖片]\n圖片描述：${desc}\n\n使用者附加的文字：${rawContent}` 
            : `[使用者傳送了圖片]\n圖片描述：${desc}`;
        }
      }

      const isDM = !message.guild;

      // 呼叫底層的 aiChat，並帶入 customConfig 覆寫設定
      reply = await client.aiChat(user, rawContent, '', [], !isDM, customConfig);

      if (reply) {
        if (typingInterval) clearInterval(typingInterval);
        if (thinkingMsg) await thinkingMsg.delete().catch(() => {});
        const chunks = client.splitMessagePreserveCodeBlocks ? client.splitMessagePreserveCodeBlocks(reply, 1900) : [reply];
        if (client.sendChunksSequentially) {
          await client.sendChunksSequentially(message, chunks, { allowedMentions: { parse: [] } });
        }
      }
    } catch (err) {
      if (typingInterval) clearInterval(typingInterval);
      if (thinkingMsg) await thinkingMsg.delete().catch(() => {});
      console.error('$. 指令錯誤:', err);
      message.reply(`❌ 發生錯誤: ${err.message}`).catch(() => {});
    }
  }
};