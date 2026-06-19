const fs = require('fs-extra');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { loadDocument, saveDocument } = require('../utils/mongodb');

const BANLIST_FILE = path.join(__dirname, '../data/banlist.json');
const CONFIG = {
  ban_channel: process.env.BAN_CHANNEL_ID || null,
  developer_ids: (process.env.DEV_USERS || process.env.DEV_USER || '').split(',').map(id => id.trim()) || []
};

let banlist = [];

async function loadBanlist() {
  const doc = await loadDocument('system_configs', 'banlist');
  if (doc) {
    banlist = Array.isArray(doc.data) ? doc.data : (doc.list || []);
  } else {
    banlist = [];
  }
}

async function saveBanlist() {
  try {
    await saveDocument('system_configs', 'banlist', { data: banlist });
  } catch (err) {
    console.error('寫入 MongoDB banlist 失敗:', err.message);
  }
}

function isBanned(userId) {
  return banlist.includes(userId);
}

async function banUser(userId, reason = '未提供原因') {
  if (isBanned(userId)) {
    return { success: false, error: '此使用者已被封鎖' };
  }
  banlist.push(userId);
  await saveBanlist();
  return { success: true, userId, reason };
}

async function unbanUser(userId) {
  const index = banlist.indexOf(userId);
  if (index === -1) {
    return { success: false, error: '該使用者未被封鎖' };
  }
  banlist.splice(index, 1);
  await saveBanlist();
  return { success: true };
}

function createBanEmbed(user, reason) {
  return new EmbedBuilder()
    .setTitle('封鎖通知')
    .setColor(0xFF0000)
    .addFields(
      { name: '使用者', value: `<@${user.id}>`, inline: true },
      { name: '使用者ID', value: `\`${user.id}\``, inline: true },
      { name: '原因', value: reason || '未提供原因' }
    )
    .setTimestamp();
}

async function sendBanLog(client, user, reason) {
  const embed = createBanEmbed(user, reason);

  if (CONFIG.ban_channel) {
    const channel = client.channels.cache.get(CONFIG.ban_channel);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(err => {
        console.error('發送到封鎖頻道失敗:', err.message);
      });
    }
  }

  for (const devId of CONFIG.developer_ids) {
    const dev = await client.users.fetch(devId).catch(() => null);
    if (dev) {
      await dev.send({ embeds: [embed] }).catch(err => {
        console.error(`私訊開發者 ${devId} 失敗:`, err.message);
      });
    }
  }
}


function getBannedEmbed() {
  return new EmbedBuilder()
    .setTitle('禁止使用')
    .setDescription('你已遭到封鎖，無法使用機器人相關功能。')
    .setColor(0xFF0000)
    .setFooter({ text: '如有問題請聯絡開發者' })
    .setTimestamp();
}

// Initial load will be triggered by bot.js or when first checked
loadBanlist();

module.exports = {
  isBanned,
  banUser,
  unbanUser,
  sendBanLog,
  getBannedEmbed,
  loadBanlist, // Export so bot.js can call it

  checkBanned: async (msgOrInteraction) => {
    const userId = msgOrInteraction.author?.id || msgOrInteraction.user?.id;
    if (!userId) return false;
    
    // Safety check: ensure banlist is loaded if it was empty
    if (banlist.length === 0) await loadBanlist();
    
    if (!isBanned(userId)) return false;

    const embed = getBannedEmbed();

    if (msgOrInteraction.reply && typeof msgOrInteraction.reply === 'function') {
      await msgOrInteraction.reply({ embeds: [embed] }).catch(() => {});
    }
    else if (msgOrInteraction.reply && msgOrInteraction.deferred !== undefined) {
      const options = { embeds: [embed], ephemeral: true };
      if (msgOrInteraction.deferred) {
        await msgOrInteraction.followUp(options).catch(() => {});
      } else {
        await msgOrInteraction.reply(options).catch(() => {});
      }
    }

    return true;
  },

  async execute(message, args, client, commandName) {
      
    const adminRoles = process.env.ADMIN_ROLE_IDS?.split(',').map(s => s.trim()) || [];
    const hasAdminRole = message.member?.roles.cache.some(r => adminRoles.includes(r.id));
    const isDeveloper = CONFIG.developer_ids.includes(message.author.id);

    if (!hasAdminRole && !isDeveloper) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('錯誤')
          .setDescription('你沒有權限使用此指令')
          .setColor(0xFF0000)
        ]
      });
    }

    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId || !/^\d+$/.test(userId)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('錯誤')
          .setDescription('請提供有效的使用者 ID')
          .setColor(0xFF0000)
        ]
      });
    }

    if (commandName === 'ban') {
      const reason = args.slice(1).join(' ') || '未提供原因';
      const result = await banUser(userId, reason);

      if (!result.success) {
        return message.reply({
          embeds: [new EmbedBuilder()
            .setTitle('錯誤')
            .setDescription(result.error)
            .setColor(0xFF0000)
          ]
        });
      }

      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await sendBanLog(client, user, result.reason);
      }

      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('封鎖成功')
          .setDescription(`已封鎖使用者 \`${userId}\`\n原因：${result.reason}`)
          .setColor(0x00FF00)
        ]
      });
    }

    if (commandName === 'unban') {
      const result = await unbanUser(userId);

      if (!result.success) {
        return message.reply({
          embeds: [new EmbedBuilder()
            .setTitle('錯誤')
            .setDescription(result.error)
            .setColor(0xFF0000)
          ]
        });
      }

      return message.reply({
        embeds: [new EmbedBuilder()
          .setTitle('解除封鎖成功')
          .setDescription(`已解除封鎖使用者 \`${userId}\``)
          .setColor(0x00FF00)
        ]
      });
    }
  }
};
