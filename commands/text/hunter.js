const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'hunter',
    description: '獵人的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 獵人` 開始。').setColor(0xFF0000)] });
        if (p.job !== '獵人') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **獵人** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'track': {
                const res = rpg.work(uid); // 獵人的 primaryAction 是 track
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🐾 追蹤')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `獸皮: ${res.player.inventory['獸皮'] || 0}`, inline: true }
                    )
                    .setColor(0x27AE60);
                return message.reply({ embeds: [embed] });
            }
            // 獵人的其他專屬指令可以在這裡添加
            // case 'trap': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。獵人可用指令：`track`').setColor(0xFF0000)] });
        }
    }
};