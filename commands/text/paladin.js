const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'paladin',
    description: '聖騎士的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 聖騎士` 開始。').setColor(0xFF0000)] });
        if (p.job !== '聖騎士') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **聖騎士** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'pray': {
                const res = rpg.work(uid); // 聖騎士的 primaryAction 是 pray
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🙏 祈禱')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `聖水: ${res.player.inventory['聖水'] || 0}`, inline: true }
                    )
                    .setColor(0xF1C40F);
                return message.reply({ embeds: [embed] });
            }
            // 聖騎士的其他專屬指令可以在這裡添加
            // case 'smite': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。聖騎士可用指令：`pray`').setColor(0xFF0000)] });
        }
    }
};