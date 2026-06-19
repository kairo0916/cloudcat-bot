const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'knight',
    description: '騎士的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 騎士` 開始。').setColor(0xFF0000)] });
        if (p.job !== '騎士') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **騎士** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'patrol': {
                const res = rpg.work(uid); // 騎士的 primaryAction 是 patrol
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ 巡邏')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前金幣', value: `${res.player.gold}`, inline: true }
                    )
                    .setColor(0x34495E);
                return message.reply({ embeds: [embed] });
            }
            // 騎士的其他專屬指令可以在這裡添加
            // case 'charge': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。騎士可用指令：`patrol`').setColor(0xFF0000)] });
        }
    }
};