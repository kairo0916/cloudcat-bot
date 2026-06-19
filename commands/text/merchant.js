const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'merchant',
    description: '商人的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 商人` 開始。').setColor(0xFF0000)] });
        if (p.job !== '商人') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **商人** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'trade': {
                const res = rpg.work(uid); // 商人的 primaryAction 是 trade
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🤝 交易')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前金幣', value: `${res.player.gold}`, inline: true }
                    )
                    .setColor(0x16A085);
                return message.reply({ embeds: [embed] });
            }
            // 商人的其他專屬指令可以在這裡添加
            // case 'invest': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。商人可用指令：`trade`').setColor(0xFF0000)] });
        }
    }
};