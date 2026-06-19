const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'bard',
    description: '吟遊詩人的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 吟遊詩人` 開始。').setColor(0xFF0000)] });
        if (p.job !== '吟遊詩人') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **吟遊詩人** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'perform': {
                const res = rpg.work(uid); // 吟遊詩人的 primaryAction 是 perform
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🎶 彈奏')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前金幣', value: `${res.player.gold}`, inline: true }
                    )
                    .setColor(0x9B59B6);
                return message.reply({ embeds: [embed] });
            }
            // 吟遊詩人的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。吟遊詩人可用指令：`perform`').setColor(0xFF0000)] });
        }
    }
};