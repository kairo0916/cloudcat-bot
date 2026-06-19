const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'druid',
    description: '德魯伊的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 德魯伊` 開始。').setColor(0xFF0000)] });
        if (p.job !== '德魯伊') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **德魯伊** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'forage': {
                const res = rpg.work(uid); // 德魯伊的 primaryAction 是 forage
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🌿 採集')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `藥草: ${res.player.inventory['藥草'] || 0}`, inline: true }
                    )
                    .setColor(0x2ECC71);
                return message.reply({ embeds: [embed] });
            }
            // 德魯伊的其他專屬指令可以在這裡添加
            // case 'shapeshift': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。德魯伊可用指令：`forage`').setColor(0xFF0000)] });
        }
    }
};