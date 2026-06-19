const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'warrior', // 指令名稱為職業名稱
    description: '戰士的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 戰士` 開始。').setColor(0xFF0000)] });
        if (p.job !== '戰士') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **戰士** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'hunt': {
                const res = await rpg.hunt(uid);
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder().setTimestamp();
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
            // 戰士的其他專屬指令可以在這裡添加
            // case 'charge': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。戰士可用指令：`hunt`').setColor(0xFF0000)] });
        }
    }
};