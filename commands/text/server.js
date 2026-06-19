const { EmbedBuilder } = require('discord.js');
const { sendError } = require('../../utils/errorHandler.js');

const PTERO_URL = process.env.PTERO_URL;
const PTERO_API_KEY = process.env.PTERO_API_KEY;
const PTERO_SERVER_ID = process.env.PTERO_SERVER_ID;

async function pteroRequest(endpoint, body) {
    try {
        const response = await fetch(`${PTERO_URL}/api/client/servers/${PTERO_SERVER_ID}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PTERO_API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

module.exports = {
    name: 'server',
    description: '管理 Minecraft 伺服器狀態',
    async execute(message, args, client) {
        const devUsers = (process.env.DEV_USERS || '').split(',').map(id => id.trim());
        if (!devUsers.includes(message.author.id)) {
            return sendError(message, '這是一項危險操作，僅限系統管理員執行！', '權限不足');
        }

        const sub = args[0]?.toLowerCase();
        
        if (sub === 'cmd') {
            const rawCmd = args.slice(1).join(' ');
            const cleanCmd = rawCmd.startsWith('/') ? rawCmd.slice(1) : rawCmd;
            const success = await pteroRequest('command', { command: cleanCmd });
            
            const embed = new EmbedBuilder()
                .setTitle(success ? "✅ 指令發送成功" : "❌ 指令發送失敗")
                .setDescription(success ? `已成功執行：\`${cleanCmd}\`` : "無法連線至面板")
                .setColor(success ? 0x57F287 : 0xED4245)
                .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
            return message.reply({ embeds: [embed] });
        }

        let signal, action, color, emoji;
        if (sub === 'start') { signal = "start"; action = "開機"; color = 0x57F287; emoji = "🟢"; }
        else if (sub === 'stop') { signal = "stop"; action = "關機"; color = 0xED4245; emoji = "🔴"; }
        else if (sub === 'restart') { signal = "restart"; action = "重啟"; color = 0xFEE75C; emoji = "🔄"; }
        else return message.reply("💡 用法: `$server start/stop/restart/cmd <指令>`");

        const success = await pteroRequest('power', { signal });
        const embed = new EmbedBuilder()
            .setTitle(success ? `${emoji} 伺服器${action}已排程` : "❌ 請求發送失敗")
            .setColor(success ? color : 0x99AAB5)
            .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
        return message.reply({ embeds: [embed] });
    }
};