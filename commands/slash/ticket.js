const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require('discord.js');
const { loadDocument, saveDocument } = require('../../utils/mongodb');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('客服單')
    .setDescription('客服單系統管理與設定')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('設定面板')
        .setDescription('發送一個高度自訂的客服單建立面板')
        .addStringOption(opt => opt.setName('標題').setDescription('面板的大標題').setRequired(true))
        .addStringOption(opt => opt.setName('描述').setDescription('面板描述內容，告訴使用者該怎麼做').setRequired(true))
        .addStringOption(opt => opt.setName('按鈕文字').setDescription('例如「開啟客服單」或「點我聯繫」').setRequired(true))
        .addStringOption(opt => 
          opt.setName('按鈕顏色')
            .setDescription('按鈕的顏色樣式')
            .setRequired(true)
            .addChoices(
              { name: '藍色 (Primary)', value: 'Primary' },
              { name: '綠色 (Success)', value: 'Success' },
              { name: '紅色 (Danger)', value: 'Danger' },
              { name: '灰色 (Secondary)', value: 'Secondary' }
            )
        )
        .addChannelOption(opt => opt.setName('分類').setDescription('創建出來的客服頻道要放在哪個分類底下').addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        .addRoleOption(opt => opt.setName('客服身分組').setDescription('除了你之外，可以看見客服單的管理員身分組').setRequired(false))
        .addIntegerOption(opt => opt.setName('最大數量').setDescription('每位使用者同時最多可開啟的客服單數量 (預設 1)').setRequired(false).setMinValue(1))
        .addChannelOption(opt => opt.setName('日誌頻道').setDescription('客服單開啟/關閉的紀錄會發送到此頻道').addChannelTypes(ChannelType.GuildText).setRequired(false))
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const category = interaction.options.getChannel('分類');
    const role = interaction.options.getRole('客服身分組');

    let config = await loadDocument('system_configs', 'ticket_config') || {};
    if (config.data && !config[interaction.guildId]) config = config.data;

    config[interaction.guildId] = {
      categoryId: category ? category.id : null,
      roleId: role ? role.id : null,
      maxTickets: interaction.options.getInteger('最大數量') || 1,
      logChannelId: interaction.options.getChannel('日誌頻道')?.id || null,
      ticketCount: (config[interaction.guildId]?.ticketCount || 0)
    };
    
    const toSave = { ...config };
    delete toSave._id;
    await saveDocument('system_configs', 'ticket_config', toSave);

    const embed = new EmbedBuilder()
      .setTitle(interaction.options.getString('標題'))
      .setDescription(interaction.options.getString('描述'))
      .setColor(0x2B2D31)
      .setFooter({ text: '點擊下方按鈕以聯繫客服團隊' });

    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_create').setLabel(interaction.options.getString('按鈕文字')).setStyle(ButtonStyle[interaction.options.getString('按鈕顏色')]));
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: '✅ 客服單面板已成功發送！' });
  }
};
