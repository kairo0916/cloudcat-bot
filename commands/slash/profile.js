const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserProfile, getIntimacyLevel } = require('../../utils/aiFeatures');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('身份資訊')
    .setDescription('查看你在白雲心中的身份及所有信息'),

  async execute(interaction) {
    await interaction.deferReply();

    const profile = await getUserProfile(interaction.user.id);
    const intimacy = profile.intimacy || 0;
    const level = getIntimacyLevel(intimacy);
    const identity = profile.identity || '未設定';
    const lastTopics = (profile.lastTopics || []).slice(0, 5);
    const anniversaries = profile.anniversaries || {};

    let embed = new EmbedBuilder()
      .setColor(0xFF8C42)
      .setTitle(`✨ ${interaction.user.username} 的身份資訊`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: '👤 你的身份',
          value: identity,
          inline: true
        },
        {
          name: '💕 親密度等級',
          value: level,
          inline: true
        },
        {
          name: '📊 親密度數值',
          value: `${intimacy}/100 ${'█'.repeat(Math.floor(intimacy / 10))}${'░'.repeat(10 - Math.floor(intimacy / 10))}`,
          inline: false
        }
      );

    if (lastTopics.length > 0) {
      embed.addFields({
        name: '🗂️ 最近談論的話題',
        value: lastTopics.join('、'),
        inline: false
      });
    }

    if (Object.keys(anniversaries).length > 0) {
      const anniversaryList = Object.entries(anniversaries)
        .map(([name, date]) => `${name} - ${date}`)
        .join('\n');
      embed.addFields({
        name: '🎂 紀念日',
        value: anniversaryList,
        inline: false
      });
    }

    const messages = {
      '陌生人': '我們才剛認識呢～ 多跟我聊聊吧！😊',
      '新朋友': '嘿！我已經有點認識你了～ 💙',
      '普通朋友': '我們相處得不錯呢！✨',
      '好朋友': '你已經成為我很重要的朋友了！💕',
      '最親密朋友': '你是我最親愛的朋友啦！我們永遠在一起吧～😆✨'
    };

    embed.addFields({
      name: '💬 白雲說',
      value: messages[level] || '✨',
      inline: false
    });

    embed.setFooter({ text: `Discord ID: ${interaction.user.id} | ${process.env.FOOTER}` });

    return interaction.editReply({ embeds: [embed] });
  }
};
