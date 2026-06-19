const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const VERBOSE_ERRORS = process.env.VERBOSE_ERRORS === 'true';

function summarizeError(err, maxLen = 300) {
  if (!err) return '未知錯誤';
  const raw = (err && err.message) ? String(err.message) : String(err);
  let single = raw.replace(/\s+/g, ' ').trim();
  if (single.length > maxLen) single = single.slice(0, maxLen - 3) + '...';
  if (VERBOSE_ERRORS && err && err.stack) {
    const stackSnippet = String(err.stack).split('\n').slice(0, 4).join(' | ');
    const combined = `${single} — ${stackSnippet}`;
    return combined.length > maxLen ? combined.slice(0, maxLen - 3) + '...' : combined;
  }
  return single;
}

function createErrorEmbed(title, description, client) {
  const safeDesc = typeof description === 'string' ? description : String(description);
  const embed = new EmbedBuilder()
    .setColor(0xED4245) // 統一使用 Discord 錯誤紅
    .setTitle(`❌ ${title || '發生錯誤'}`)
    .setDescription(`\`\`\`\n${safeDesc.length > 1000 ? safeDesc.slice(0, 997) + '...' : safeDesc}\n\`\`\``)
    .setTimestamp();
  
  const botName = process.env.BOT_NAME || 'Bot';
  if (client && client.user) {
    embed.setFooter({ text: botName, iconURL: client.user.displayAvatarURL() || null });
  } else {
    embed.setFooter({ text: botName });
  }
  return embed;
}

function sendError(target, err, title) {
  // Try to get client from target
  const client = target.client || (target.guild ? target.guild.client : null);
  
  const summary = summarizeError(err);
  const embed = createErrorEmbed(title, summary, client);
  const options = { embeds: [embed], flags: MessageFlags.Ephemeral };
  try {
    if (target && typeof target.reply === 'function') {
      return target.reply(options).catch(e => {
        if (e.code === 40060 || e.message?.includes('already replied') || target.deferred) {
          return target.followUp(options).catch(()=>{});
        }
        if (target.channel && typeof target.channel.send === 'function') {
          return target.channel.send(options).catch(()=>{});
        }
      });
    }
    if (target && target.channel && typeof target.channel.send === 'function') {
      return target.channel.send(options).catch(()=>{});
    }
  } catch (e) {
    console.error('sendError failed:', e);
  }
}

module.exports = {
  summarizeError,
  createErrorEmbed,
  sendError
};
