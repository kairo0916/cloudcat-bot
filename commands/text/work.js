const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');

module.exports = {
    name: 'work',
    aliases: [
        'meditate', 'steal', 'pray', 'track', 'forage', 'ambush', 
        'brew', 'chop', 'plant', 'mine', 'forge', 'cook', 
        'perform', 'bless', 'summon', 'target', 'patrol', 'trade'
    ],
    description: '處理所有非戰鬥職業的專屬採集/工作指令',
    async execute(message, args, client, config, cmdName) {
        const uid = message.author.id;
        const p = await rpg.getPlayer(uid);
        
        // 獲取玩家剛剛輸入的指令名稱 (例如 mine, chop)
        const prefix = process.env.PREFIX || '$';
        const actualCmd = cmdName || message.content.split(/\s+/)[0].slice(prefix.length).toLowerCase();

        if (!p) return message.reply({ embeds: [new EmbedBuilder().setDescription('你還沒有角色！請使用 `$rpg create <職業>` 創建。').setColor(0xFF0000)] });
        
        const jobInfo = rpg.PROFESSIONS[p.job];
        if (!jobInfo) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ 找不到你的職業資料！`).setColor(0xFF0000)] });

        // 檢查玩家輸入的指令，是否和他的職業動作匹配
        // 舉例：礦工的專屬動作是 'mine'，如果他打 $chop，就會被擋下來並提示
        if (jobInfo.primaryAction !== actualCmd) {
            return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ 你的職業是 **${p.job}**，專屬指令是 \`$${jobInfo.primaryAction}\`！\n不能使用 \`$${actualCmd}\` 喔。`).setColor(0xFF0000)] });
        }

        // 執行該職業的工作
        const res = rpg.work(uid);
        if (res.error) return message.reply({ embeds: [new EmbedBuilder().setDescription(`❌ ${res.error}`).setColor(0xFF0000)] });
        
        const embed = new EmbedBuilder()
            .setTitle(`🛠️ 職業行動`)
            .setDescription(res.message)
            .setColor(0x8E44AD);

        return message.reply({ embeds: [embed] });
    }
};