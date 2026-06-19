const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'hunt',
    description: '戰士的專屬狩獵指令',
    async execute(message, args, client) {
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 戰士` 開始。').setColor(0xFF0000)] });
        
        // 檢查玩家是不是戰士
        const jobInfo = rpg.PROFESSIONS[p.job];
        if (!jobInfo || jobInfo.primaryAction !== 'hunt') {
            return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ 只有 **戰士** 才能使用 \`$hunt\` 指令！你目前是 **${p.job}**，請輸入 \`$${jobInfo?.primaryAction}\`。`).setColor(0xFF0000)] });
        }

        const res = await rpg.hunt(uid);
        if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
        
        const embed = new EmbedBuilder().setTimestamp()
            .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
        if (res.event) {
            embed.setTitle('🌈 隨機事件').setDescription(res.message).setColor(0xFFAA00);
        } else if (res.win) {
            embed.setTitle(`⚔️ 擊敗了 ${res.monster.name}!`)
                .setDescription(`獲得金幣: ${res.monster.gold}\n獲得經驗: ${res.monster.exp}${res.levelUp ? '\n🎊 **恭喜升級！**' : ''}`)
                .setColor(0x00FF00);
        } else {
            embed.setTitle('💀 戰鬥失敗').setDescription(`你被 ${res.monster.name} 擊倒了...`).setColor(0xFF0000);
        }
        return message.reply({ embeds: [embed] });
    }
};