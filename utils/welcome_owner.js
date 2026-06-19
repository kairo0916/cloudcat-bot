const { EmbedBuilder } = require('discord.js');

function getOwnerWelcomeEmbed(guild, client) {
  return new EmbedBuilder()
    .setTitle('💙 歡迎使用白雲 AI 機器人！')
    .setDescription(`感謝你將 **白雲** 邀請至 **${guild.name}**！\n我是你的全能 Discord 夥伴，結合了強大的 AI 聊天、豐富的遊戲與實用的管理工具。\n\n為了讓你能快速上手，請參考以下的使用說明與基本準則：`)
    .setColor(0x8B7AFF)
    .addFields(
      { 
        name: '📝 使用方法：', 
        value: `**1. AI 對話與記憶**\n無需輸入指令，直接在頻道中標記 \`@白雲\` 即可開始自然對話。白雲會記住你們的互動，並隨著對話次數提升親密度！使用 \`/ai\` 指令管理你的身份與記憶。\n\n**2. 豐富的娛樂系統**\n輸入 \`/遊戲\` 即可體驗 2048、猜拳、21點、踩地雷等十多種互動小遊戲。搭配 \`/經濟\` 系統，讓伺服器充滿活力！\n\n**3. 伺服器專屬設定**\n身為服主，你可以使用 \`/設置\` 來客製化你的伺服器。例如設定成員加入的歡迎訊息、開啟專屬的客服單系統，或是設定 Minecraft 伺服器狀態監控。`,
        inline: false 
      },
      { 
        name: '📜 基本準則：', 
        value: `**1. 尊重與友善：** 請勿使用白雲生成惡意、仇恨或攻擊性的言論。\n**2. 隱私保護：** 請勿在對話中透露真實世界的敏感個人資訊（如密碼、信用卡號）。\n**3. 合理使用：** 請避免惡意刷屏或使用自動化腳本頻繁調用指令，以免影響其他用戶的體驗。\n**4. 探索與發現：** 隨時使用 \`/幫助\` 指令來探索白雲的新功能，功能會持續更新！\n**5. 尋求協助：** 如果遇到 Bug 或有任何建議，歡迎點擊下方按鈕加入官方支援群回報。`,
        inline: false 
      }
    )
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: '白雲 AI — 陪伴你的每一天', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

module.exports = { getOwnerWelcomeEmbed };

