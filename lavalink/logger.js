const os = require('os');

const COLORS = {
  DEBUG: '\x1b[35m',   INFO: '\x1b[34m',
  WARN: '\x1b[33m',    ERROR: '\x1b[31m',
  SUCCESS: '\x1b[32m', RESET: '\x1b[0m'
};

function formatTime() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function baseLog({ level = 'INFO', emoji = '🎵', title = '系統訊息', guild, user, node, details }) {
  const color = COLORS[level] || COLORS.INFO;
  let output = `${color}[${formatTime()}] ${emoji} [${level}] ${title}${COLORS.RESET}\n`;
  if (guild) output += `[伺服器] ${guild}\n`;
  if (user) output += `[使用者] ${user}\n`;
  if (node) output += `[Node] ${node}\n`;
  if (details) output += `${(guild || user || node) ? '\n' : ''}${details}\n`;
  output += '----------------------------------------';
  console.log(output);
}

module.exports = {
  debug: (opt) => baseLog({ ...opt, level: 'DEBUG', emoji: opt.emoji || '🐛' }),
  info: (opt) => baseLog({ ...opt, level: 'INFO', emoji: opt.emoji || '🎵' }),
  warn: (opt) => baseLog({ ...opt, level: 'WARN', emoji: opt.emoji || '⚠️' }),
  error: (opt) => baseLog({ ...opt, level: 'ERROR', emoji: opt.emoji || '❌' }),
  success: (opt) => baseLog({ ...opt, level: 'SUCCESS', emoji: opt.emoji || '✅' }),
  getSystemStats: () => {
    const memoryUsage = process.memoryUsage();
    const uptimeSecs = process.uptime();
    return {
      memoryStr: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`,
      uptimeStr: `${Math.floor(uptimeSecs / 86400)}d ${Math.floor((uptimeSecs % 86400) / 3600)}h`,
      cpuStr: `${os.loadavg()[0].toFixed(2)}%`
    };
  }
};