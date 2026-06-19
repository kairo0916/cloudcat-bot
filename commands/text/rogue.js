const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'rogue',
    description: '盜賊的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 盜賊` 開始。').setColor(0xFF0000)] });
        if (p.job !== '盜賊') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **盜賊** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'steal': {
                const res = rpg.work(uid); // 盜賊的 primaryAction 是 steal
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('💰 偷竊')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前金幣', value: `${res.player.gold}`, inline: true }
                    )
                    .setColor(0x95A5A6);
                return message.reply({ embeds: [embed] });
            }
            // 盜賊的其他專屬指令可以在這裡添加
            // case 'hide': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。盜賊可用指令：`steal`').setColor(0xFF0000)] });
        }
    }
};