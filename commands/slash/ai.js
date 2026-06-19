const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserProfile, getIntimacyLevel, setUserIdentity, checkAnniversaries } = require('../../utils/aiFeatures');
const { loadMemory } = require('../../utils/db_helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('白雲 AI 核心 - 管理你的身份與情感連結')
    .addSubcommand(sub => sub.setName('親密度').setDescription('查看你與白雲的親密度等級'))
    .addSubcommand(sub => sub.setName('身份設定').setDescription('設定你在白雲心中的身份名稱').addStringOption(o=>o.setName('名稱').setDescription('例如：魔法師、大領主').setRequired(true)))
    .addSubcommand(sub => sub.setName('紀念日').setDescription('查看即將到來的紀念日'))
    .addSubcommand(sub => sub.setName('搜尋記憶').setDescription('搜尋你與白雲之前的對話記錄').addStringOption(o=>o.setName('關鍵字').setDescription('輸入要搜尋的詞').setRequired(true)))
    .addSubcommand(sub => sub.setName('統計資料').setDescription('讓 AI 分析你與它的對話紀錄並產生一份報告')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === '親密度') {
      await interaction.deferReply();
      const profile = await getUserProfile(userId);
      const intimacy = profile.intimacy || 0;
      const level = getIntimacyLevel(intimacy);
      const embed = new EmbedBuilder().setTitle('💕 與白雲的親密度').setColor(0x8B7AFF)
        .setDescription(`## 目前身份\n**${profile.identity || '朋友'}**\n\n## 親密度等級\n**${level}**\n\n\`\`\`\n${'█'.repeat(Math.floor(intimacy / 10))}${'░'.repeat(10 - Math.floor(intimacy / 10))} ${intimacy}%\n\`\`\``);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === '身份設定') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const name = interaction.options.getString('名稱');
      await setUserIdentity(userId, name);
      return interaction.editReply({ content: `✨ 身份已更新！在白雲心中，你現在是 **${name}** 囉～` });
    }

    if (sub === '紀念日') {
      await interaction.deferReply();
      const annis = await checkAnniversaries(userId);
      const text = annis.length > 0 ? annis.join('\n') : '目前沒有即將到來的紀念日。';
      const embed = new EmbedBuilder().setTitle('📅 重要紀念日').setDescription(text).setColor(0xFF8C42);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === '搜尋記憶') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const key = interaction.options.getString('關鍵字');
      const { searchInUserMemory } = require('../../utils/cohereEnhanced');
      const results = await searchInUserMemory(userId, key);
      const text = results.length > 0 ? results.map(r => `• ${r.message}`).join('\n\n') : '找不到相關的記憶...';
      const embed = new EmbedBuilder().setTitle(`🔍 搜尋結果: ${key}`).setDescription(text.slice(0, 4000)).setColor(0x42D9FF);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === '統計資料') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const memory = await loadMemory(userId);

      if (!memory || memory.length < 10) {
        return interaction.editReply({ content: '❌ 你和白雲的對話紀錄還不夠多，沒辦法進行分析喔！再多聊聊吧～' });
      }

      const historyText = memory
        .map(m => `${m.role === 'USER' ? '使用者' : '白雲'}: ${m.message}`)
        .join('\n');

      const analysisPrompt = `這是你和使用者「${interaction.user.username}」的完整對話紀錄。請你根據這些紀錄，以一個客觀、誠實的旁觀者角度，用繁體中文分析並總結以下幾點（不需要刻意說好話）：
1.  **主要話題分析**：你們最常聊天的幾個核心話題是什麼？
2.  **常用語句**：這位使用者最常說的一句話或口頭禪是什麼？
3.  **性格側寫**：根據對話風格和內容，你覺得這位使用者是個怎麼樣的人？

---
對話紀錄：
\`\`\`
${historyText.slice(-8000)}
\`\`\`
---

請直接生成你的分析報告。`;

      const analysisResult = await client.aiChat(interaction.user, analysisPrompt, '你現在是一位對話分析師，請根據提供的對話紀錄，產出一份客觀的分析報告。', [], false);

      const embed = new EmbedBuilder()
        .setTitle(`📝 與 ${interaction.user.username} 的對話分析報告`)
        .setDescription(analysisResult || '分析失敗，AI 可能正在忙碌中，請稍後再試。')
        .setColor(0x8B7AFF)
        .setFooter({ text: '此分析由 AI 基於歷史對話生成' });
      
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
