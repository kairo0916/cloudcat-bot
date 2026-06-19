const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'monk',
    description: '武僧的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 武僧` 開始。').setColor(0xFF0000)] });
        if (p.job !== '武僧') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **武僧** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'meditate': {
                const res = rpg.work(uid); // 武僧的 primaryAction 是 meditate
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🧘 修煉')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '當前經驗值', value: `${res.player.exp}/${res.player.nextLevel}`, inline: true }
                    )
                    .setColor(0xF39C12);
                return message.reply({ embeds: [embed] });
            }
            // 武僧的其他專屬指令可以在這裡添加
            // case 'focus': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。武僧可用指令：`meditate`').setColor(0xFF0000)] });
        }
    }
};