const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { loadDocument, saveDocument } = require('../../utils/mongodb');

const REPORT_USER_ID = (process.env.DEV_USERS || '').split(',').map(id => id.trim()).filter(Boolean);
const COOLDOWN_SECONDS = 30 * 60;
const UPDATE_INTERVAL = 60000; // Updated from 100ms to 60s for DB
let cooldownData = {};

async function loadCooldownData() {
  const doc = await loadDocument('system_configs', 'report_time');
  if (doc) {
    cooldownData = Object.fromEntries(
      Object.entries(doc).filter(([k]) => k !== '_id').map(([userId, timestamp]) => [
        userId,
        Number(timestamp) || 0
      ])
    );
  } else {
    cooldownData = {};
  }
}

async function saveCooldownData() {
  try {
    await saveDocument('system_configs', 'report_time', cooldownData);
  } catch (err) {
    console.error('寫入 MongoDB report_time 失敗:', err.message);
  }
}

function getTaiwanTime() {
  return Date.now() + 8 * 60 * 60 * 1000;
}

function formatTaiwanTime(ms) {
  const date = new Date(ms - 8 * 60 * 60 * 1000);
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/\//g, '/');
}

function startCooldownUpdater() {
  setInterval(async () => {
    const now = getTaiwanTime();
    let changed = false;
    for (const userId in cooldownData) {
      if (cooldownData[userId] > now) {
        continue;
      } else {
        delete cooldownData[userId];
        changed = true;
      }
    }
    if (changed) await saveCooldownData();
  }, UPDATE_INTERVAL);
}

// Initial load
loadCooldownData().then(() => startCooldownUpdater());

module.exports = {
  data: new SlashCommandBuilder()
    .setName('回報問題')
    .setDescription('回報機器人問題或建議（每 30 分鐘一次）')
    .addStringOption(option =>
      option
        .setName('內容')
        .setDescription('請詳細描述問題或建議')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;
    const now = getTaiwanTime();

    if (cooldownData[userId] && cooldownData[userId] > now) {
      const remaining = Math.ceil((cooldownData[userId] - now) / 1000);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return interaction.editReply({ content: `冷卻中！請等待 \`${minutes} 分 ${seconds} 秒\` 後再回報。` });
    }

    const content = interaction.options.getString('內容');
    const guildName = interaction.guild?.name || '私訊';

    cooldownData[userId] = now + COOLDOWN_SECONDS * 1000;
    await saveCooldownData();

    const embed = new EmbedBuilder()
      .setTitle('有人回報了問題')
      .setColor(0xFFA500)
      .addFields(
        { name: '使用者', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
        { name: '伺服器', value: guildName, inline: true },
        { name: '回報內容', value: content },
        { name: '回報時間', value: formatTaiwanTime(now) }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: process.env.FOOTER });

    try {
      const reportUserIds = Array.isArray(REPORT_USER_ID) ? REPORT_USER_ID : [REPORT_USER_ID];
      let successCount = 0;
      for (const reportUserId of reportUserIds) {
        try {
          const reportUser = await interaction.client.users.fetch(reportUserId);
          await reportUser.send({ embeds: [embed] });
          successCount++;
        } catch (err) {
          console.error(`無法發送回報 DM 給 ${reportUserId}:`, err.message);
        }
      }
      
      if (successCount === 0) {
        throw new Error('無法聯繫任何開發者');
      }
    } catch (err) {
      console.error('無法發送回報 DM:', err.message);
      delete cooldownData[userId];
      await saveCooldownData();
      return interaction.editReply({ content: '❌ 回報失敗：無法聯繫開發者（DM 已關閉或 ID 錯誤）。' });
    }

    await interaction.editReply({ content: '✅ 你的問題已成功回報給開發者！感謝你的反饋！' });
  }
};
