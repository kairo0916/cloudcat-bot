const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'alchemist',
    description: '煉金術師的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 煉金術師` 開始。').setColor(0xFF0000)] });
        if (p.job !== '煉金術師') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **煉金術師** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'brew': {
                const res = rpg.work(uid); // 煉金術師的 primaryAction 是 brew
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('⚗️ 調配')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `藥水: ${res.player.inventory['藥水'] || 0}\n藥草: ${res.player.inventory['藥草'] || 0}`, inline: true }
                    )
                    .setColor(0x9B59B6)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            // 煉金術師的其他專屬指令可以在這裡添加
            // case 'transmute': { ... }
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。煉金術師可用指令：`brew`').setColor(0xFF0000)] });
        }
    }
};