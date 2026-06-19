const {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require('discord.js');
const os = require('os');
const process = require('process');

module.exports = {
  name: 'panel',
  description: '進階控制面板',
  async execute(message, args, client) {
    const devUsers = (process.env.DEV_USERS || '').split(',').map(id => id.trim());
    if (!devUsers.includes(message.author.id)) {
      return message.reply({ content: '⚠️ 你沒有權限開啟控制面板。' });
    }

    const baseEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('🧭 進階控制面板')
      .setDescription('選擇下方選單以切換資訊類別或執行管理操作。')
      .setFooter({ text: `由 ${message.author.username} 開啟 | ${process.env.FOOTER || '白雲喵喵'}`, iconURL: client.user?.displayAvatarURL() });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('panel_menu')
      .setPlaceholder('📂 選擇要查看或操作的項目')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('📊 系統與資源統計')
          .setValue('stats')
          .setDescription('查看 CPU、記憶體、機器人狀態'),
        new StringSelectMenuOptionBuilder()
          .setLabel(' 伺服器總覽')
          .setValue('servers')
          .setDescription('查看所有伺服器的基本資訊'),
        new StringSelectMenuOptionBuilder()
          .setLabel('⚙️ 維護與控制')
          .setValue('admin')
          .setDescription('重啟機器人等進階控制功能'),
      ]);

    const closeBtn = new ButtonBuilder()
      .setCustomId('close_panel')
      .setLabel('❌ 關閉面板')
      .setStyle(ButtonStyle.Danger);

    const rowMenu = new ActionRowBuilder().addComponents(menu);
    const rowBtns = new ActionRowBuilder().addComponents(closeBtn);

    const sent = await message.channel.send({
      embeds: [baseEmbed],
      components: [rowMenu, rowBtns],
    });

    const collector = sent.createMessageComponentCollector({
      time: 120000,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ content: '⚠️ 這不是你的面板。', flags: MessageFlags.Ephemeral });
      }

      if (interaction.isStringSelectMenu()) {
        const value = interaction.values[0];
        let embed;
        let components = [rowMenu, rowBtns];

        if (value === 'servers') {
          const totalGuilds = client.guilds.cache.size;
          const guilds = client.guilds.cache
            .map(g => `📌 **${g.name}**\n👥 成員: ${g.memberCount}\n🆔 ${g.id}`)
            .slice(0, 10)
            .join('\n\n');
          
          embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('📝 伺服器總覽')
            .setDescription(guilds ? `${guilds}\n\n...共 ${totalGuilds} 個伺服器` : '目前沒有伺服器。')
            .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
        } 
        else if (value === 'stats') {
          const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
          const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
          const usedMem = (totalMem - freeMem).toFixed(2);
          const botMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
          
          const uptimeSec = Math.floor(process.uptime());
          const uptimeStr = `${Math.floor(uptimeSec / 86400)}天 ${Math.floor(uptimeSec % 86400 / 3600)}小時 ${Math.floor(uptimeSec % 3600 / 60)}分`;

          embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('📊 系統與資源統計')
            .addFields(
              { name: '🤖 機器人名稱', value: client.user.username, inline: true },
              { name: '📶 連線延遲', value: `${client.ws.ping}ms`, inline: true },
              { name: '⏱️ 上線時間', value: uptimeStr, inline: true },
              { name: '💻 主機 CPU', value: `${os.cpus()[0].model}`, inline: false },
              { name: '💽 主機記憶體', value: `${usedMem} GB / ${totalMem} GB`, inline: true },
              { name: '📦 Bot 記憶體使用', value: `${botMem} MB`, inline: true },
              { name: '🌐 總伺服器/用戶數', value: `${client.guilds.cache.size} 伺服器 / ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} 用戶`, inline: false }
            )
            .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
        }
        else if (value === 'admin') {
          embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('⚙️ 維護與控制')
            .setDescription('請小心使用以下操作，這些指令將直接影響機器人的運行狀態。')
            .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });

          const adminBtns = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('restart_bot')
              .setLabel('🔄 重啟機器人')
              .setStyle(ButtonStyle.Danger)
          );
          
          components = [rowMenu, adminBtns, rowBtns];
        }

        await interaction.update({ embeds: [embed], components });
      } 
      else if (interaction.isButton()) {
        if (interaction.customId === 'close_panel') {
          await interaction.update({ content: '🧾 控制面板已關閉。', embeds: [], components: [] });
          collector.stop();
        } else if (interaction.customId === 'restart_bot') {
          await interaction.update({ content: '🔄 機器人正在重新啟動...', embeds: [], components: [] });
          console.log(`[Panel] 重啟指令由 ${message.author.username} 觸發`);
          process.exit(0);
        }
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason !== 'user') {
        rowMenu.components[0].setDisabled(true);
        closeBtn.setDisabled(true);
        await sent.edit({ components: [rowMenu, rowBtns] }).catch(() => {});
      }
    });
  },
};