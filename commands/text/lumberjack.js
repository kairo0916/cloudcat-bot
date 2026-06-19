const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'lumberjack',
    description: '伐木工的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 伐木工` 開始。').setColor(0xFF0000)] });
        if (p.job !== '伐木工') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **伐木工** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'chop': {
                const res = rpg.work(uid); // 伐木工的 primaryAction 是 chop
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🌳 砍樹')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `木材: ${res.player.inventory['木材'] || 0}`, inline: true }
                    )
                    .setColor(0x8B4513);
                return message.reply({ embeds: [embed] });
            }
            // 伐木工的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。伐木工可用指令：`chop`').setColor(0xFF0000)] });
        }
    }
};