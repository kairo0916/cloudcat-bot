const { EmbedBuilder } = require('discord.js');
const { loadDocument } = require('./mongodb');

async function sendLog(guild, type, embed) {
  if (!guild || !guild.id) return;
  try {
    const logConfigDoc = await loadDocument('system_configs', 'log_channels');
    const guildLogConfig = logConfigDoc?.[guild.id];
    if (guildLogConfig && guildLogConfig[type]) {
      const channel = await guild.client.channels.fetch(guildLogConfig[type]).catch(() => null);
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    console.error(`[LogSystem] Failed to send log type ${type} for guild ${guild.id}:`, e);
  }
}

module.exports = { sendLog };