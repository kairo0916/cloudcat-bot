const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'chef',
    description: '廚師的專屬指令',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請輸入 `$rpg create 廚師` 開始。').setColor(0xFF0000)] });
        if (p.job !== '廚師') return message.reply({ embeds: [new EmbedBuilder().setDescription(`只有 **廚師** 才能使用此指令！你目前是 **${p.job}**。`).setColor(0xFF0000)] });

        switch (sub) {
            case 'cook': {
                const res = rpg.work(uid); // 廚師的 primaryAction 是 cook
                if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
                
                const embed = new EmbedBuilder()
                    .setTitle('🍳 烹飪')
                    .setDescription(res.message)
                    .addFields(
                        { name: '當前體力值', value: `${res.player.stamina}/${res.player.maxStamina}`, inline: true },
                        { name: '背包', value: `便當: ${res.player.inventory['便當'] || 0}\n小麥: ${res.player.inventory['小麥'] || 0}`, inline: true }
                    )
                    .setColor(0xE67E22);
                return message.reply({ embeds: [embed] });
            }
            // 廚師的其他專屬指令可以在這裡添加
            default:
                return message.reply({ embeds: [new EmbedBuilder().setDescription('❓ 未知指令。廚師可用指令：`cook`').setColor(0xFF0000)] });
        }
    }
};