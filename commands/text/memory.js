const { EmbedBuilder, MessageFlags } = require('discord.js');
const { loadDocument, saveDocument } = require('../../utils/mongodb');

module.exports = {
  name: 'memory',
  description: '管理白雲的公共記憶',
  async execute(message, args) {
    const PREFIX = process.env.PREFIX || '>';
    if (!args || args.length === 0) {
      return message.reply({ content: `❌ 參數錯誤。使用方式：\n\`${PREFIX}memory add <內容>\`\n\`${PREFIX}memory remove <內容>\`\n\`${PREFIX}memory list\`` });
    }

    const sub = args[0].toLowerCase();
    const content = args.slice(1).join(' ');

    let doc = await loadDocument('system_configs', 'bot_memory') || { memories: [] };
    if (doc.data) doc = doc.data; // 相容可能有包裹 data 的結構
    if (!doc.memories) doc.memories = [];

    if (sub === 'add') {
      if (!content) return message.reply('❌ 請提供要加入的記憶內容。');
      if (doc.memories.includes(content)) return message.reply('⚠️ 這筆記憶已經存在囉！');
      
      doc.memories.push(content);
      await saveDocument('system_configs', 'bot_memory', doc);
      return message.reply(`✅ 成功加入公共記憶：\n\`${content}\``);
    }

    if (sub === 'remove') {
      if (!content) return message.reply('❌ 請提供要移除的記憶內容（需完全相符）。');
      const idx = doc.memories.indexOf(content);
      if (idx === -1) return message.reply('❌ 找不到這筆記憶。');

      doc.memories.splice(idx, 1);
      await saveDocument('system_configs', 'bot_memory', doc);
      return message.reply(`🗑️ 已刪除公共記憶：\n\`${content}\``);
    }

    if (sub === 'list') {
      if (doc.memories.length === 0) return message.reply('☁️ 目前沒有任何公共記憶。');

      const itemsPerPage = 10;
      const pages = Math.ceil(doc.memories.length / itemsPerPage);
      let currentPage = 1;

      const generateEmbed = (page) => {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const currentItems = doc.memories.slice(start, end);
        
        const desc = currentItems.map((m, i) => `**${start + i + 1}.** ${m}`).join('\n\n');
        
        return new EmbedBuilder()
          .setTitle('🧠 白雲的公共記憶庫')
          .setDescription(desc)
          .setColor(0x3498DB)
          .setFooter({ text: `第 ${page} / ${pages} 頁 | 共 ${doc.memories.length} 筆` });
      };

      const embed = generateEmbed(currentPage);
      
      // 如果只有一頁，直接發送
      if (pages === 1) return message.reply({ embeds: [embed] });

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev_mem').setLabel('上一頁').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('next_mem').setLabel('下一頁').setStyle(ButtonStyle.Primary)
      );

      const replyMsg = await message.reply({ embeds: [embed], components: [row] });
      const collector = replyMsg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id) return i.reply({ content: '❌ 你不能操作這個按鈕！', flags: MessageFlags.Ephemeral });

        if (i.customId === 'prev_mem') currentPage--;
        if (i.customId === 'next_mem') currentPage++;

        row.components[0].setDisabled(currentPage === 1);
        row.components[1].setDisabled(currentPage === pages);

        await i.update({ embeds: [generateEmbed(currentPage)], components: [row] });
      });

      collector.on('end', () => {
        replyMsg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    return message.reply({ content: '❌ 無效的子指令。可用：`add`, `remove`, `list`。' });
  }
};
