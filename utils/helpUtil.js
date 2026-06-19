const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

function generateHelpInterface(client, interactionOrMessage, prefix) {
  const isInteraction = !!interactionOrMessage.isCommand;
  const user = isInteraction ? interactionOrMessage.user : interactionOrMessage.author;
  
  // 收集斜線指令
  const slashList = [];
  for (const cmd of client.slashCommands.values()) {
    const data = cmd.data;
    if (!data) continue;
    
    // 將所有根指令和子指令展平
    let hasSubs = false;
    if (data.options) {
      for (const opt of data.options) {
        const optData = opt.toJSON ? opt.toJSON() : opt;
        if (optData.type === 1) { // SUB_COMMAND
          slashList.push({ name: `/${data.name} ${optData.name}`, desc: optData.description });
          hasSubs = true;
        } else if (optData.type === 2) { // SUB_COMMAND_GROUP
          if (optData.options) {
            for (const subOpt of optData.options) {
              slashList.push({ name: `/${data.name} ${optData.name} ${subOpt.name}`, desc: subOpt.description });
            }
          }
          hasSubs = true;
        }
      }
    }
    if (!hasSubs) {
      slashList.push({ name: `/${data.name}`, desc: data.description || '無說明' });
    }
  }

  // 收集回文指令 (去除別名重複)
  const textList = [];
  const uniqueTextCmds = new Set();
  for (const cmd of client.textCommands.values()) {
    if (!uniqueTextCmds.has(cmd.name)) {
      uniqueTextCmds.add(cmd.name);
      textList.push({ name: `${prefix}${cmd.name}`, desc: cmd.description || '無說明' });
    }
  }

  const itemsPerPage = 10;
  
  const generateEmbed = (type, page) => {
    const list = type === 'slash' ? slashList : textList;
    const pages = Math.ceil(list.length / itemsPerPage) || 1;
    const safePage = Math.max(1, Math.min(page, pages));
    
    const start = (safePage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = list.slice(start, end);
    
    let desc = '';
    for (const item of currentItems) {
      desc += `**${item.name}**\n${item.desc}\n\n`;
    }
    
    if (desc === '') desc = '目前沒有任何指令。';

    return new EmbedBuilder()
      .setTitle('📚 指令幫助')
      .setDescription(desc)
      .setColor(0x8B7AFF)
      .setFooter({ text: `第 ${safePage} / ${pages} 頁 | 共 ${list.length} 個指令` });
  };

  return {
    slashList,
    textList,
    generateEmbed,
    itemsPerPage
  };
}

async function sendHelpMenu(client, interactionOrMessage, prefix) {
  const isInteraction = !!interactionOrMessage.isCommand;
  const user = isInteraction ? interactionOrMessage.user : interactionOrMessage.author;
  
  const helper = generateHelpInterface(client, interactionOrMessage, prefix);
  
  let currentType = 'slash'; // 預設顯示斜線指令
  let currentPage = 1;

  const mainEmbed = new EmbedBuilder()
    .setTitle('📚 指令幫助')
    .setDescription(`嗨！我是白雲，你的專屬 AI 助理～\n點擊下方的按鈕，就可以查看我所有的指令清單喔！\n如果有任何問題，隨時歡迎直接 @我 跟我聊天！`)
    .setColor(0x8B7AFF)
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user.displayAvatarURL() });

  const getRow1 = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_slash').setLabel('斜線指令').setStyle(currentType === 'slash' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('help_text').setLabel('回文指令').setStyle(currentType === 'text' ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  const getRow2 = () => {
    const list = currentType === 'slash' ? helper.slashList : helper.textList;
    const pages = Math.ceil(list.length / helper.itemsPerPage) || 1;
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('help_prev').setLabel('◀ 上一頁').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 1),
      new ButtonBuilder().setCustomId('help_next').setLabel('下一頁 ▶').setStyle(ButtonStyle.Primary).setDisabled(currentPage === pages)
    );
  };

  let responseMsg;
  if (isInteraction) {
    if (interactionOrMessage.deferred || interactionOrMessage.replied) {
      responseMsg = await interactionOrMessage.editReply({ embeds: [mainEmbed], components: [getRow1()] });
    } else {
      responseMsg = await interactionOrMessage.reply({ embeds: [mainEmbed], components: [getRow1()], fetchReply: true });
    }
  } else {
    responseMsg = await interactionOrMessage.reply({ embeds: [mainEmbed], components: [getRow1()] });
  }

  const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

  collector.on('collect', async i => {
    if (i.user.id !== user.id) {
      return i.reply({ content: '❌ 你不能操作這個按鈕！', flags: MessageFlags.Ephemeral });
    }

    if (i.customId === 'help_slash') {
      currentType = 'slash';
      currentPage = 1;
    } else if (i.customId === 'help_text') {
      currentType = 'text';
      currentPage = 1;
    } else if (i.customId === 'help_prev') {
      currentPage--;
    } else if (i.customId === 'help_next') {
      currentPage++;
    }

    await i.update({
      embeds: [helper.generateEmbed(currentType, currentPage)],
      components: [getRow1(), getRow2()]
    }).catch(() => {});
  });

  collector.on('end', () => {
    responseMsg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { sendHelpMenu };