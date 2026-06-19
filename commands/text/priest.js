const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'priest',
    description: '牧師的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 牧師` 開始。').setColor(0xFF0000)] });
        if (p.job !== '牧師') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **牧師** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'bless': {
                const res = rpg.work(uid); // 牧師的 primaryAction 是 bless
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('✨ 祝福')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `聖光精華: ${res.player.inventory['聖光精華'] || 0}`, inline: true }
                    )
                    .setColor(0xFFFFFF);
                return message.reply({ embeds: [embed] });
            }
            // 牧師的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。牧師可用指令：`bless`').setColor(0xFF0000)] });
        }
    }
};