const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'archer',
    description: '弓箭手的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 弓箭手` 開始。').setColor(0xFF0000)] });
        if (p.job !== '弓箭手') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **弓箭手** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'target': {
                const res = rpg.work(uid); // 弓箭手的 primaryAction 是 target
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🎯 練靶')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前經驗值', value: `${res.player.exp}/${res.player.nextLevel}`, inline: true }
                    )
                    .setColor(0x1ABC9C);
                return message.reply({ embeds: [embed] });
            }
            // 弓箭手的其他專屬指令可以在這裡添加
            // case 'volley': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。弓箭手可用指令：`target`').setColor(0xFF0000)] });
        }
    }
};