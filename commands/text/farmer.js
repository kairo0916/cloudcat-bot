const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'farmer',
    description: '農夫的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 農夫` 開始。').setColor(0xFF0000)] });
        if (p.job !== '農夫') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **農夫** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'plant': {
                const res = rpg.work(uid); // 農夫的 primaryAction 是 plant
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🌾 耕種')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `小麥: ${res.player.inventory['小麥'] || 0}`, inline: true }
                    )
                    .setColor(0xF39C12);
                return message.reply({ embeds: [embed] });
            }
            // 農夫的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。農夫可用指令：`plant`').setColor(0xFF0000)] });
        }
    }
};