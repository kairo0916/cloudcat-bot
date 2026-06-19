const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'necromancer',
    description: '死靈法師的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 死靈法師` 開始。').setColor(0xFF0000)] });
        if (p.job !== '死靈法師') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **死靈法師** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'summon': {
                const res = rpg.work(uid); // 死靈法師的 primaryAction 是 summon
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('💀 召喚')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `靈魂碎屑: ${res.player.inventory['靈魂碎屑'] || 0}`, inline: true }
                    )
                    .setColor(0x7B241C);
                return message.reply({ embeds: [embed] });
            }
            // 死靈法師的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。死靈法師可用指令：`summon`').setColor(0xFF0000)] });
        }
    }
};