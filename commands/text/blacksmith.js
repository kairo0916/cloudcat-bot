const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'blacksmith',
    description: '鐵匠的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 鐵匠` 開始。').setColor(0xFF0000)] });
        if (p.job !== '鐵匠') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **鐵匠** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'forge': {
                const res = rpg.work(uid); // 鐵匠的 primaryAction 是 forge
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🔥 鍛造')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `鐵錠: ${res.player.inventory['鐵錠'] || 0}\n礦石: ${res.player.inventory['礦石'] || 0}`, inline: true }
                    )
                    .setColor(0x607D8B);
                return message.reply({ embeds: [embed] });
            }
            // 鐵匠的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。鐵匠可用指令：`forge`').setColor(0xFF0000)] });
        }
    }
};