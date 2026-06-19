const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'assassin',
    description: '暗殺者的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 暗殺者` 開始。').setColor(0xFF0000)] });
        if (p.job !== '暗殺者') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **暗殺者** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'ambush': {
                const res = rpg.work(uid); // 暗殺者的 primaryAction 是 ambush
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🔪 伏擊')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前金幣', value: `${res.player.gold}`, inline: true }
                    )
                    .setColor(0x2C3E50);
                return message.reply({ embeds: [embed] });
            }
            // 暗殺者的其他專屬指令可以在這裡添加
            // case 'poison': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。暗殺者可用指令：`ambush`').setColor(0xFF0000)] });
        }
    }
};