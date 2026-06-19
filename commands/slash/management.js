const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, MessageFlags, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const { loadDocument, saveDocument, getCollection } = require('../../utils/mongodb');
const { Collection } = require('discord.js');
const { sendError } = require('../../utils/errorHandler');
const { sendLog } = require('../../utils/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('管理')
    .setDescription('伺服器綜合管理與設置中心')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // --- 連結過濾 (New!) ---
    .addSubcommandGroup(group =>
      group.setName('連結過濾')
        .setDescription('設定特定頻道的網址攔截功能')
        .addSubcommand(sub =>
          sub.setName('設定')
            .setDescription('啟用或關閉連結過濾')
            .addBooleanOption(o => o.setName('狀態').setDescription('開啟/關閉').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('頻道管理')
            .setDescription('新增或移除過濾頻道')
            .addChannelOption(o => o.setName('頻道').setDescription('選擇頻道').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addStringOption(o => o.setName('操作').setDescription('新增或移除').setRequired(true).addChoices({name:'新增',value:'add'},{name:'移除',value:'remove'}))
        )
        .addSubcommand(sub => sub.setName('狀態').setDescription('查看連結過濾的當前配置'))
    )
    // --- 日誌系統 ---
    .addSubcommandGroup(group =>
      group.setName('日誌設定')
        .setDescription('設定各類事件的日誌頻道')
        .addSubcommand(sub => sub.setName('成員').setDescription('設定成員加入/離開/變更的日誌').addChannelOption(o => o.setName('頻道').setDescription('選擇日誌頻道 (留空則關閉)').setRequired(false)))
        .addSubcommand(sub => sub.setName('訊息').setDescription('設定訊息編輯/刪除的日誌').addChannelOption(o => o.setName('頻道').setDescription('選擇日誌頻道 (留空則關閉)').setRequired(false)))
        .addSubcommand(sub => sub.setName('語音').setDescription('設定語音頻道活動的日誌').addChannelOption(o => o.setName('頻道').setDescription('選擇日誌頻道 (留空則關閉)').setRequired(false)))
        .addSubcommand(sub => sub.setName('管理').setDescription('設定管理員操作 (踢出/封鎖) 的日誌').addChannelOption(o => o.setName('頻道').setDescription('選擇日誌頻道 (留空則關閉)').setRequired(false)))
    )
    // --- 警告系統 ---
    .addSubcommandGroup(group =>
      group.setName('警告設定')
        .setDescription('設定自動警告懲處規則')
        .addSubcommand(sub =>
          sub.setName('設定')
            .setDescription('設定警告達到一定次數後的自動懲處')
            .addIntegerOption(o => o.setName('觸發次數').setDescription('警告達到幾次時觸發 (0為關閉)').setRequired(true).setMinValue(0))
            .addStringOption(o => o.setName('懲罰動作').setDescription('要執行的懲罰').setRequired(true).addChoices(
              { name: '禁言 (Timeout)', value: 'timeout' }, { name: '踢出 (Kick)', value: 'kick' }, { name: '封鎖 (Ban)', value: 'ban' }
            ))
            .addIntegerOption(o => o.setName('禁言時長').setDescription('如果選擇禁言，禁言多少分鐘 (1-40320)').setRequired(false).setMinValue(1).setMaxValue(40320))
        )
        .addSubcommand(sub => sub.setName('狀態').setDescription('查看當前的自動懲處設定'))
    )
    // --- 伺服器進階設置 (整合舊功能) ---
    .addSubcommandGroup(group =>
      group.setName('伺服器設定')
        .setDescription('設置歡迎、離開、自動身份組、抓鬼、防洗頻、生日提醒、MC監控系統')
        .addSubcommand(sub =>
          sub.setName('歡迎頻道')
            .setDescription('設置成員加入時的訊息')
            .addChannelOption(o => o.setName('頻道').setDescription('選擇頻道').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addBooleanOption(o => o.setName('啟用').setDescription('是否啟用').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('離開頻道') // From settings.js
            .setDescription('設置成員離開時的訊息')
            .addChannelOption(o => o.setName('頻道').setDescription('選擇頻道').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addBooleanOption(o => o.setName('啟用').setDescription('是否啟用').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('自動身份組')
            .setDescription('設置新成員加入時獲取的身份組')
            .addRoleOption(o => o.setName('身份組').setDescription('選擇身份組').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('抓鬼設定')
            .setDescription('開啟或關閉抓鬼偵測 (Ghost Ping)')
            .addBooleanOption(o => o.setName('狀態').setDescription('是否啟用').setRequired(true))
        )
        .addSubcommand(sub => // From settings.js
          sub.setName('防洗頻')
            .setDescription('設定防洗頻功能開關')
            .addStringOption(o => o.setName('狀態').setDescription('開啟或關閉').setRequired(true).addChoices({name:'開啟',value:'on'},{name:'關閉',value:'off'}))
        )
        .addSubcommand(sub => // From settings.js
          sub.setName('mc監控')
            .setDescription('開啟自動刷新狀態')
            .addChannelOption(o => o.setName('頻道').setDescription('發送頻道').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addStringOption(o => o.setName('域名').setDescription('伺服器 IP').setRequired(true))
        )
        .addSubcommand(sub => // From settings.js
          sub.setName('生日提醒頻道')
            .setDescription('設定生日祝福發送的頻道')
            .addChannelOption(o => o.setName('頻道').setDescription('選擇頻道').setRequired(true))
        )
        .addSubcommand(sub => // From settings.js
          sub.setName('生日提醒開關')
            .setDescription('開啟或關閉生日提醒功能')
            .addStringOption(o => o.setName('狀態').setDescription('選擇狀態').setRequired(true).addChoices({name:'開啟',value:'on'},{name:'關閉',value:'off'}))
        )
    )
    // 頻道管理
    .addSubcommandGroup(group =>
      group.setName('頻道管理')
        .setDescription('管理頻道權限與設定')
        .addSubcommand(sub => sub.setName('鎖定').setDescription('關閉當前頻道發言權限').addChannelOption(o => o.setName('頻道').setDescription('要鎖定的頻道 (預設當前頻道)').setRequired(false)))
        .addSubcommand(sub => sub.setName('解鎖').setDescription('開啟當前頻道發言權限').addChannelOption(o => o.setName('頻道').setDescription('要解鎖的頻道 (預設當前頻道)').setRequired(false)))
        .addSubcommand(sub => sub.setName('慢速模式').setDescription('設定頻道慢速模式').addIntegerOption(o => o.setName('秒數').setDescription('冷卻時間(秒)，0為關閉').setMinValue(0).setMaxValue(21600).setRequired(true)).addChannelOption(o => o.setName('頻道').setDescription('目標頻道').setRequired(false)))
    )
    // --- 成員管理 --- (Ported from manage.js)
    .addSubcommandGroup(group =>
      group.setName('成員管理')
        .setDescription('管理伺服器成員 (踢出、封鎖、禁言)')
        .addSubcommand(sub =>
          sub.setName('踢出')
            .setDescription('將指定成員踢出伺服器')
            .addUserOption(o => o.setName('目標').setDescription('要踢出的使用者').setRequired(true))
            .addStringOption(o => o.setName('原因').setDescription('原因').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('封鎖')
            .setDescription('將指定成員封鎖 (Ban)')
            .addUserOption(o => o.setName('目標').setDescription('要封鎖的使用者').setRequired(true))
            .addStringOption(o => o.setName('原因').setDescription('原因').setRequired(false))
            .addIntegerOption(o => o.setName('刪除訊息天數').setDescription('刪除該使用者幾天內的訊息 (0-7)').setRequired(false).setMinValue(0).setMaxValue(7))
        )
        .addSubcommand(sub =>
          sub.setName('禁言')
            .setDescription('將指定成員禁言 (Timeout)')
            .addUserOption(o => o.setName('目標').setDescription('要禁言的使用者').setRequired(true))
            .addIntegerOption(o => o.setName('分鐘').setDescription('禁言時間 (分鐘)').setRequired(true).setMinValue(1).setMaxValue(40320))
            .addStringOption(o => o.setName('原因').setDescription('原因').setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName('警告')
            .setDescription('對成員發出警告')
            .addUserOption(o => o.setName('目標').setDescription('要警告的使用者').setRequired(true))
            .addStringOption(o => o.setName('原因').setDescription('警告原因').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('查看警告')
            .setDescription('查看成員的警告紀錄')
            .addUserOption(o => o.setName('目標').setDescription('要查詢的使用者').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('清除警告')
            .setDescription('清除成員的所有警告紀錄')
            .addUserOption(o => o.setName('目標').setDescription('要清除紀錄的使用者').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('解除禁言')
            .setDescription('解除指定成員的禁言')
            .addUserOption(o => o.setName('目標').setDescription('要解除禁言的使用者').setRequired(true))
        )
    )
    // --- 工具 --- (New group for general tools from settings.js)
    .addSubcommandGroup(group =>
      group.setName('工具')
        .setDescription('伺服器實用工具')
        .addSubcommand(sub => sub.setName('清理邀請').setDescription('刪除本伺服器所有邀請連結'))
        .addSubcommand(sub =>
          sub.setName('測試訊息')
            .setDescription('測試發送歡迎或離開訊息。')
            .addStringOption(option =>
              option.setName('type')
                .setDescription('要測試的訊息類型')
                .setRequired(true)
                .addChoices({ name: '歡迎 (Welcome)', value: 'welcome' }, { name: '離開 (Leave)', value: 'leave' })
            ).addStringOption(option =>
              option.setName('background')
                .setDescription('圖片背景的 URL (可選)')))
    )
    .addSubcommand(sub =>
      sub.setName('清除訊息')
        .setDescription('批量刪除頻道訊息')
        .addIntegerOption(o =>
          o.setName('數量')
            .setDescription('刪除數量 (1-99999)')
            .setMinValue(1)
            .setMaxValue(99999)
            .setRequired(true))
        .addUserOption(o => o.setName('使用者').setDescription('僅刪除此使用者的訊息 (選填)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('公告')
        .setDescription('發送精美公告')
        .addChannelOption(o => o.setName('頻道').setDescription('發送目標').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(o => o.setName('標題').setDescription('公告標題').setRequired(true))
        .addStringOption(o => o.setName('內容').setDescription('公告詳細內容').setRequired(true))
        .addStringOption(o => o.setName('顏色').setDescription('側邊條顏色 (十六進位，如 #FF0000)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('全球公告')
        .setDescription('向所有安裝此機器人的伺服器發送公告 (開發者專用)')
        .addStringOption(o => o.setName('標題').setDescription('公告標題').setRequired(true))
        .addStringOption(o => o.setName('內容').setDescription('公告內容').setRequired(true))
        .addStringOption(o => o.setName('圖片').setDescription('圖片連結 (選填)').setRequired(false))
    ),

  async execute(interaction, client) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // 連結過濾邏輯
    if (group === '連結過濾') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let doc = await loadDocument('system_configs', 'link_filter') || {};
      if (!doc[interaction.guildId]) doc[interaction.guildId] = { enabled: false, channels: [] };
      if (sub === '設定') {
        doc[interaction.guildId].enabled = interaction.options.getBoolean('狀態');
        await saveDocument('system_configs', 'link_filter', doc);
        return interaction.editReply({ content: `✅ 連結過濾已${doc[interaction.guildId].enabled ? '開啟' : '關閉'}。` });
      }
      if (sub === '頻道管理') {
        const channel = interaction.options.getChannel('頻道');
        const action = interaction.options.getString('操作');
        if (action === 'add') {
          if (!doc[interaction.guildId].channels.includes(channel.id)) doc[interaction.guildId].channels.push(channel.id);
        } else {
          doc[interaction.guildId].channels = doc[interaction.guildId].channels.filter(id => id !== channel.id);
        }
        await saveDocument('system_configs', 'link_filter', doc);
        return interaction.editReply({ content: `✅ 頻道 <#${channel.id}> 已${action === 'add' ? '新增至' : '從'}過濾清單${action === 'add' ? '' : '移除'}。` });
      }
      if (sub === '狀態') {
        const config = doc[guildId];
        if (!config || !config.enabled) {
          return interaction.editReply({ content: '❌ 連結過濾功能目前已關閉。' });
        }
        const channelList = config.channels.length > 0 ? config.channels.map(id => `<#${id}>`).join(', ') : '無';
        const embed = new EmbedBuilder()
          .setTitle('🔗 連結過濾狀態')
          .setDescription(`**狀態：** ${config.enabled ? '✅ 開啟' : '❌ 關閉'}\n**過濾頻道：** ${channelList}`)
          .setColor(0x3498DB);
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // 全球公告邏輯
    if (sub === '全球公告') {
      const devUsers = (process.env.DEV_USERS || '').split(',').map(id => id.trim());
      if (!devUsers.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ 此指令僅限系統開發者使用。', flags: MessageFlags.Ephemeral });
      }

      const title = interaction.options.getString('標題');
      const content = interaction.options.getString('內容');
      const image = interaction.options.getString('圖片');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const embed = new EmbedBuilder()
        .setTitle(`📢 全球系統公告：${title}`)
        .setDescription(content.replace(/\\n/g, '\n'))
        .setColor(0xFFAA00)
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: '來自雲喵開發團隊的訊息' });

      if (image) embed.setImage(image);

      let successCount = 0, failCount = 0;
      for (const guild of client.guilds.cache.values()) {
        try {
          const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
          if (channel) { await channel.send({ embeds: [embed] }); successCount++; }
          else failCount++;
        } catch { failCount++; }
      }
      return interaction.editReply(`✅ 全球公告發送完成！\n成功：${successCount} 個伺服器 | 失敗：${failCount} 個`);
    }

    // 日誌設定邏輯
    if (group === '日誌設定') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const logTypeMap = { '成員': 'member', '訊息': 'message', '語音': 'voice', '管理': 'mod' };
      const typeKey = logTypeMap[sub];
      if (!typeKey) return interaction.editReply({ content: '❌ 無效的日誌類型。' });

      const channel = interaction.options.getChannel('頻道');
      let doc = await loadDocument('system_configs', 'log_channels') || {};
      if (!doc[guildId]) doc[guildId] = {};

      if (channel) {
        doc[guildId][typeKey] = channel.id;
        await saveDocument('system_configs', 'log_channels', doc);
        return interaction.editReply({ content: `✅ **${sub}** 日誌頻道已設定為 <#${channel.id}>。` });
      } else {
        delete doc[guildId][typeKey];
        await saveDocument('system_configs', 'log_channels', doc);
        return interaction.editReply({ content: `✅ 已關閉 **${sub}** 日誌。` });
      }
    }

    // 警告設定邏輯
    if (group === '警告設定') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let doc = await loadDocument('system_configs', 'warn_config') || {};
      if (sub === '設定') {
        const triggerCount = interaction.options.getInteger('觸發次數');
        if (triggerCount === 0) {
          delete doc[guildId];
          await saveDocument('system_configs', 'warn_config', doc);
          return interaction.editReply({ content: '✅ 已關閉自動懲處功能。' });
        }
        const action = interaction.options.getString('懲罰動作');
        const duration = interaction.options.getInteger('禁言時長');
        if (action === 'timeout' && !duration) {
          return interaction.editReply({ content: '❌ 選擇禁言作為懲罰時，必須設定禁言時長。' });
        }
        doc[guildId] = { triggerCount, action, duration: action === 'timeout' ? duration : null };
        await saveDocument('system_configs', 'warn_config', doc);
        return interaction.editReply({ content: `✅ 自動懲處已設定：警告滿 **${triggerCount}** 次後將自動 **${action}**。` });
      }
      if (sub === '狀態') {
        const config = doc[guildId];
        if (!config || config.triggerCount === 0) {
          return interaction.editReply({ content: 'ℹ️ 目前未設定自動懲處規則。' });
        }
        let desc = `當成員警告次數達到 **${config.triggerCount}** 次，將會自動執行 **${config.action}**。`;
        if (config.action === 'timeout') {
          desc += `\n禁言時長為 **${config.duration}** 分鐘。`;
        }
        const embed = new EmbedBuilder().setTitle('⚙️ 自動警告懲處設定').setDescription(desc).setColor(0x3498DB);
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // 伺服器設定邏輯
    if (group === '伺服器設定') {
      if (sub === '歡迎頻道' || sub === '離開頻道') {
        const type = sub === '歡迎頻道' ? 'welcome' : 'leave';
        const typeText = sub === '歡迎頻道' ? '歡迎' : '離開';
        
        const doc = await loadDocument('system_configs', type) || {};
        const currentConfig = doc[interaction.guildId] || {};

        const modal = new ModalBuilder()
          .setCustomId(`set_${type}_message_modal_${interaction.id}`)
          .setTitle(`設定${typeText}訊息`);

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel("訊息標題 (可用 {user}, {server}, {userID}, {time})")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(`預設：${type === 'welcome' ? '✨ 歡迎新成員！' : '👋 成員離開了'}`)
          .setValue(currentConfig.title || '')
          .setRequired(false);

        const messageInput = new TextInputBuilder()
          .setCustomId('message')
          .setLabel("訊息內容 (可用 {user}, {server}, {userID}, {time})")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("請在此輸入歡迎/離開訊息，支援換行。")
          .setValue(currentConfig.message || '')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(messageInput));

        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
            time: 300000, // 5 minutes
            filter: i => i.customId === `set_${type}_message_modal_${interaction.id}` && i.user.id === interaction.user.id,
        }).catch(() => null);

        if (submitted) {
            const channel = interaction.options.getChannel('頻道');
            const enabled = interaction.options.getBoolean('啟用');
            const title = submitted.fields.getTextInputValue('title');
            const message = submitted.fields.getTextInputValue('message');

            const cfg = { channel: channel.id, enabled, message, title: title || null };
            
            let docToSave = await loadDocument('system_configs', type) || {};
            docToSave[interaction.guildId] = cfg;
            await saveDocument('system_configs', type, docToSave);

            await submitted.reply({ content: `✅ ${typeText}訊息已設定完成。`, ephemeral: true });
        }
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (sub === '抓鬼設定') {
        const state = interaction.options.getBoolean('狀態');
        let doc = await loadDocument('system_configs', 'ghost_ping_config') || {};
        doc[interaction.guildId] = { enabled: state };
        await saveDocument('system_configs', 'ghost_ping_config', doc);
        return interaction.editReply({ content: `✅ 抓鬼系統已於本伺服器 **${state ? '開啟' : '關閉'}**。` });
      }
      if (sub === '防洗頻') { // From settings.js
        const state = interaction.options.getString('狀態') === 'on';
        let configs = await loadDocument('system_configs', 'antispam') || {};
        configs[guildId] = { enabled: state };
        await saveDocument('system_configs', 'antispam', configs);
        return interaction.editReply({ content: `✅ 防洗頻功能已 **${state ? '開啟' : '關閉'}**！\n(將自動刪除連續快速發送大量訊息的行為)` });
      }
      if (sub === 'mc監控') { // From settings.js
        const channel = interaction.options.getChannel('頻道');
        const domain = interaction.options.getString('域名');
        let configs = await loadDocument('system_configs', 'statusChannel') || {};
        configs[guildId] = { channelId: channel.id, domain, messageId: null };
        await saveDocument('system_configs', 'statusChannel', configs);
        return interaction.editReply({ content: `✔ 已排程於 <#${channel.id}> 監控 \`${domain}\`！` });
      }
      if (sub === '生日提醒頻道') { // From settings.js
        const channel = interaction.options.getChannel('頻道');
        let configs = await loadDocument('system_configs', 'birthday_config') || {};
        const config = configs[guildId] || { enabled: false, channelId: null };
        config.channelId = channel.id;
        configs[guildId] = config;
        await saveDocument('system_configs', 'birthday_config', configs);
        return interaction.editReply({ content: `✅ 生日祝福頻道已設定為 <#${config.channelId}>！` });
      }
      if (sub === '生日提醒開關') { // From settings.js
        const state = interaction.options.getString('狀態') === 'on';
        let configs = await loadDocument('system_configs', 'birthday_config') || {};
        const config = configs[guildId] || { enabled: false, channelId: null };
        config.enabled = state;
        configs[guildId] = config;
        await saveDocument('system_configs', 'birthday_config', configs);
        return interaction.editReply({ content: `✅ 伺服器生日提醒功能已 **${config.enabled ? '開啟' : '關閉'}**！` });
      }
    }

    // 頻道管理邏輯 (From settings.js)
    if (group === '頻道管理') {
      if (sub === '鎖定' || sub === '解鎖') {
        const channel = interaction.options.getChannel('頻道') || interaction.channel;
        const lock = sub === '鎖定';
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: !lock
          });
          const logEmbed = new EmbedBuilder()
            .setColor(lock ? 0xE74C3C : 0x2ECC71)
            .setDescription(`${lock ? '🔒' : '🔓'} <#${channel.id}> 已被 <@${interaction.user.id}> **${lock ? '鎖定' : '解鎖'}**。`);
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply({ content: `✅ <#${channel.id}> 已成功**${lock ? '鎖定' : '解鎖'}**。` });
        } catch (e) {
          return interaction.editReply({ content: `❌ 操作失敗，請確認我有足夠權限管理頻道。` });
        }
      }
      if (sub === '慢速模式') {
        const seconds = interaction.options.getInteger('秒數');
        const channel = interaction.options.getChannel('頻道') || interaction.channel;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          await channel.setRateLimitPerUser(seconds);
          const logEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription(`⏱️ <#${channel.id}> 的慢速模式被 <@${interaction.user.id}> 設定為 **${seconds} 秒**。`);
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply({ content: `✅ <#${channel.id}> 的慢速模式已設定為 **${seconds} 秒**。` });
        } catch (e) {
          return interaction.editReply({ content: `❌ 設定失敗，請確認權限。` });
        }
      }
    }

    // 成員管理邏輯 (From manage.js)
    if (group === '成員管理') {
      try {
        if (sub === '踢出') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          const reason = interaction.options.getString('原因') || '管理員未提供原因';
          await interaction.guild.members.kick(target.id, reason);
          const logEmbed = new EmbedBuilder().setColor(0xFFA500).setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setDescription(`👢 **成員被踢出**`).addFields({ name: '目標', value: `<@${target.id}> (${target.tag})`, inline: true },{ name: '執行者', value: `<@${interaction.user.id}>`, inline: true },{ name: '原因', value: reason }).setTimestamp();
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply(`✅ 已成功將 **${target.tag}** 踢出。\n📝 原因：${reason}`);
        }
        if (sub === '封鎖') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          const reason = interaction.options.getString('原因') || '管理員未提供原因';
          const days = interaction.options.getInteger('刪除訊息天數') || 0;
          await interaction.guild.members.ban(target.id, { deleteMessageSeconds: days * 86400, reason });
          const logEmbed = new EmbedBuilder().setColor(0xC70039).setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setDescription(`🚫 **成員被封鎖**`).addFields({ name: '目標', value: `<@${target.id}> (${target.tag})`, inline: true },{ name: '執行者', value: `<@${interaction.user.id}>`, inline: true },{ name: '原因', value: reason }).setTimestamp();
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply(`✅ 已成功封鎖 **${target.tag}**。\n📝 原因：${reason}`);
        }
        if (sub === '禁言') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          const minutes = interaction.options.getInteger('分鐘');
          const reason = interaction.options.getString('原因') || '未提供原因';
          await interaction.guild.members.cache.get(target.id)?.timeout(minutes * 60 * 1000, reason);
          const logEmbed = new EmbedBuilder().setColor(0xE67E22).setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setDescription(`🤐 **成員被禁言**`).addFields({ name: '目標', value: `<@${target.id}> (${target.tag})`, inline: true },{ name: '執行者', value: `<@${interaction.user.id}>`, inline: true }, { name: '時長', value: `${minutes} 分鐘` }, { name: '原因', value: reason }).setTimestamp();
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply(`✅ 已將 **${target.tag}** 禁言 **${minutes}** 分鐘。\n📝 原因：${reason}`);
        }
        if (sub === '警告') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          const reason = interaction.options.getString('原因');
          const moderator = interaction.user;
          if (target.bot) return interaction.editReply('❌ 不能警告機器人。');
          if (target.id === moderator.id) return interaction.editReply('❌ 不能警告自己。');
          const warningsDoc = await loadDocument('warnings', guildId) || { users: {} };
          if (!warningsDoc.users) warningsDoc.users = {};
          if (!warningsDoc.users[target.id]) warningsDoc.users[target.id] = [];
          warningsDoc.users[target.id].push({ moderatorId: moderator.id, reason: reason, timestamp: new Date().toISOString() });
          await saveDocument('warnings', guildId, warningsDoc);
          try {
            const dmEmbed = new EmbedBuilder().setTitle(`⚠️ 您在 ${interaction.guild.name} 收到一則警告`).setColor(0xFFCC00).addFields({ name: '原因', value: reason }, { name: '執行管理員', value: moderator.tag }).setTimestamp();
            await target.send({ embeds: [dmEmbed] });
          } catch (e) {}
          const logEmbed = new EmbedBuilder().setColor(0xFFCC00).setAuthor({ name: moderator.tag, iconURL: moderator.displayAvatarURL() }).setDescription(`⚠️ **成員被警告**`).addFields({ name: '目標', value: `<@${target.id}> (${target.tag})`, inline: true },{ name: '執行者', value: `<@${moderator.id}>`, inline: true },{ name: '原因', value: reason },{ name: '累計警告次數', value: `${warningsDoc.users[target.id].length} 次` }).setTimestamp();
          await sendLog(interaction.guild, 'mod', logEmbed);
          await interaction.editReply(`✅ 已對 **${target.tag}** 發出警告。原因：${reason}`);
          const warnConfigDoc = await loadDocument('system_configs', 'warn_config') || {};
          const guildWarnConfig = warnConfigDoc[guildId];
          if (guildWarnConfig && guildWarnConfig.triggerCount > 0 && warningsDoc.users[target.id].length >= guildWarnConfig.triggerCount) {
            const member = await interaction.guild.members.fetch(target.id).catch(()=>null);
            if (!member) return;
            let punishmentMessage = ``;
            const punishmentReason = `自動懲處：累計 ${warningsDoc.users[target.id].length} 次警告。`;
            try {
              if (guildWarnConfig.action === 'timeout') {
                const minutes = guildWarnConfig.duration || 10;
                await member.timeout(minutes * 60 * 1000, punishmentReason);
                punishmentMessage = `已自動將 <@${target.id}> **禁言 ${minutes} 分鐘**。`;
              } else if (guildWarnConfig.action === 'kick') {
                await member.kick(punishmentReason);
                punishmentMessage = `已自動將 <@${target.id}> **踢出伺服器**。`;
              } else if (guildWarnConfig.action === 'ban') {
                await member.ban({ reason: punishmentReason });
                punishmentMessage = `已自動將 <@${target.id}> **封鎖**。`;
              }
              delete warningsDoc.users[target.id];
              await saveDocument('warnings', guildId, warningsDoc);
              punishmentMessage += `\n該成員的警告紀錄已被清除。`;
              const punishmentLogEmbed = new EmbedBuilder().setColor(0xFF0000).setAuthor({ name: client.user.tag, iconURL: client.user.displayAvatarURL() }).setDescription(`🚨 **自動懲處執行**`).addFields({ name: '目標', value: `<@${target.id}>` },{ name: '原因', value: punishmentReason },{ name: '執行動作', value: guildWarnConfig.action }).setTimestamp();
              await sendLog(interaction.guild, 'mod', punishmentLogEmbed);
              await interaction.followUp({ content: punishmentMessage, ephemeral: true });
            } catch (e) {
              await interaction.followUp({ content: `❌ 自動懲處 <@${target.id}> 失敗，請檢查我的權限。`, ephemeral: true });
            }
          }
          return;
        }
        if (sub === '查看警告') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          const warningsDoc = await loadDocument('warnings', guildId) || { users: {} };
          const userWarnings = warningsDoc.users?.[target.id] || [];
          if (userWarnings.length === 0) {
            return interaction.editReply({ content: `✅ **${target.tag}** 沒有任何警告紀錄。` });
          }
          let description = `**${target.tag}** 的警告紀錄 (${userWarnings.length} 次)：\n\n`;
          userWarnings.forEach((warn, index) => {
            description += `**${index + 1}.** 原因：${warn.reason}\n   執行者：<@${warn.moderatorId}>\n   時間：<t:${Math.floor(new Date(warn.timestamp).getTime() / 1000)}:f>\n`;
          });
          const embed = new EmbedBuilder().setTitle('📜 警告紀錄').setDescription(description).setColor(0xFFCC00);
          return interaction.editReply({ embeds: [embed] });
        }
        if (sub === '清除警告') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          const warningsDoc = await loadDocument('warnings', guildId) || { users: {} };
          if (!warningsDoc.users?.[target.id]) {
            return interaction.editReply({ content: `✅ **${target.tag}** 本來就沒有警告紀錄。` });
          }
          delete warningsDoc.users[target.id];
          await saveDocument('warnings', guildId, warningsDoc);
          const logEmbed = new EmbedBuilder().setColor(0x2ECC71).setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setDescription(`🧹 **成員警告已清除**`).addFields({ name: '目標', value: `<@${target.id}> (${target.tag})`, inline: true },{ name: '執行者', value: `<@${interaction.user.id}>`, inline: true }).setTimestamp();
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply({ content: `✅ 已清除 **${target.tag}** 的所有警告紀錄。` });
        }
        if (sub === '解除禁言') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const target = interaction.options.getUser('目標');
          await interaction.guild.members.cache.get(target.id)?.timeout(null);
          const logEmbed = new EmbedBuilder().setColor(0x2ECC71).setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setDescription(`🙌 **成員禁言已解除**`).addFields({ name: '目標', value: `<@${target.id}> (${target.tag})`, inline: true },{ name: '執行者', value: `<@${interaction.user.id}>`, inline: true }).setTimestamp();
          await sendLog(interaction.guild, 'mod', logEmbed);
          return interaction.editReply(`✅ 已解除 **${target.tag}** 的禁言。`);
        }
      } catch (error) {
        return interaction.editReply(`❌ 執行失敗：請確認我有權限對目標執行此操作 (${error.message})`);
      }
    }

    // 工具邏輯 (From settings.js)
    if (group === '工具') {
      if (sub === '清理邀請') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const invites = await interaction.guild.invites.fetch();
          let count = 0;
          for (const [code, invite] of invites) {
            await invite.delete().catch(()=>null);
            count++;
          }
          return interaction.editReply(`✅ 已成功清理 **${count}** 個邀請連結！`);
        } catch (e) {
          return interaction.editReply(`❌ 清理邀請連結失敗，請確認我有「管理伺服器」權限。`);
        }
      }
      if (sub === '測試訊息') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const type = interaction.options.getString('type');
        const background = interaction.options.getString('background');
        const member = interaction.member;

        let config;
        try {
          const doc = await loadDocument('system_configs', type);
          config = doc?.[member.guild.id];
        } catch (e) {
          return interaction.editReply({ content: `讀取 ${type === 'welcome' ? '歡迎' : '離開'} 訊息設定時發生錯誤。` });
        }

        if (!config || !config.enabled) {
          return interaction.editReply({ content: `${type === 'welcome' ? '歡迎' : '離開'} 訊息未啟用，無法測試。` });
        }

        await interaction.editReply({ content: `正在發送測試 ${type === 'welcome' ? '歡迎' : '離開'} 訊息...` });

        const titleText = config.title || (type === 'welcome' ? '✨ 歡迎新成員！' : '👋 成員離開了');
        const color = type === 'welcome' ? 0x57F287 : 0xED4245;

        const title = titleText
          .replaceAll("{user}", interaction.user.username)
          .replaceAll("{userID}", interaction.user.id)
          .replaceAll("{time}", new Date().toLocaleString("zh-TW"))
          .replaceAll("{server}", interaction.guild.name);

        const testMessage = config.message
          .replaceAll("{user}", `<@${interaction.user.id}>`)
          .replaceAll("{userID}", interaction.user.id)
          .replaceAll("{time}", new Date().toLocaleString("zh-TW"))
          .replaceAll("{server}", interaction.guild.name);

        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const memberCount = member.guild.memberCount;
        const generateWelcomeImage = require('../../utils/imageGenerator.js');
        const imageBuffer = await generateWelcomeImage(type, member.user.username, avatarURL, background, memberCount, member.guild.name);

        const embed = new EmbedBuilder()
          .setTitle(`${title} (測試)`)
          .setDescription(testMessage)
          .setColor(color)
          .setTimestamp()
          .setFooter({ text: `成員 ID: ${member.id}` });

        let files = [];
        if (imageBuffer) {
          const attachment = { attachment: imageBuffer, name: `${type}_test.png` };
          embed.setImage(`attachment://${type}_test.png`);
          files.push(attachment);
        } else {
          embed.setThumbnail(avatarURL);
        }

        const targetChannel = interaction.guild.channels.cache.get(config.channel);
        if (targetChannel) {
          await targetChannel.send({ content: `<@${member.id}> (這是一則測試訊息)`, embeds: [embed], files });
        } else {
          await interaction.followUp({ content: '❌ 找不到設定的頻道，無法發送測試訊息。', ephemeral: true });
        }
      }
    }

    // 清除訊息邏輯 (Fixed and enhanced)
    if (sub === '清除訊息') {
      const amount = interaction.options.getInteger('數量');
      const targetUser = interaction.options.getUser('使用者');
      let deletedCount = 0;
      let lastMessageId = null;

      // Permission check for bot
      const botMember = interaction.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xff5555)
            .setTitle('機器人權限不足')
            .setDescription('我需要 **管理訊息** 權限才能刪除訊息。\n請給予我此權限後再試一次。')
            .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      try {
        while (deletedCount < amount) {
          const fetchLimit = Math.min(amount - deletedCount, 100); // Fetch up to 100 messages at a time
          const fetchOptions = { limit: fetchLimit };
          if (lastMessageId) fetchOptions.before = lastMessageId;

          const messages = await interaction.channel.messages.fetch(fetchOptions).catch(() => new Collection());
          if (messages.size === 0) break; // No more messages to fetch

          let messagesToDelete = messages;

          // Filter by target user if specified
          if (targetUser) {
            messagesToDelete = messages.filter(m => m.author.id === targetUser.id);
          }

          // Discord's bulkDelete can only delete messages up to 14 days old.
          // For older messages, we need to delete them one by one (which is rate-limited).
          const deletableMessages = messagesToDelete.filter(m => (Date.now() - m.createdTimestamp) < 1209600000); // 14 days in ms
          const oldMessages = messagesToDelete.filter(m => (Date.now() - m.createdTimestamp) >= 1209600000);

          // Log before deleting
          const logEmbed = new EmbedBuilder().setColor(0xE74C3C).setDescription(`🗑️ <@${interaction.user.id}> 在 <#${interaction.channel.id}> 刪除了 **${amount}** 則訊息。`);
          if (targetUser) logEmbed.addFields({ name: '目標使用者', value: `<@${targetUser.id}>` });
          await sendLog(interaction.guild, 'mod', logEmbed);

          if (deletableMessages.size > 0) {
            const deleted = await interaction.channel.bulkDelete(deletableMessages, true).catch(err => {
              console.error('Bulk delete 失敗:', err);
              return new Collection();
            });
            deletedCount += deleted.size;
          }

          // Handle older messages (delete one by one, very slow and rate-limited)
          for (const msg of oldMessages.values()) {
            if (deletedCount >= amount) break; // Stop if we've reached the desired amount
            await msg.delete().catch(() => {});
            deletedCount++;
            await sleep(1000); // Rate limit for single message deletion
          }

          lastMessageId = messages.last()?.id; // Always get the oldest message ID from the fetched batch to continue
          if (messages.size < fetchLimit && deletedCount < amount) break; // If we fetched less than limit and still need more, means we hit end of channel
          if (deletedCount < amount) await sleep(1500); // Wait between batches to avoid rate limits
        }
      } catch (error) {
        console.error('清除訊息時發生錯誤:', error);
        return interaction.editReply({ content: `❌ 清理訊息時發生錯誤：${error.message}` });
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x55ff55)
        .setTitle('訊息已清除')
        .addFields(
          { name: '已刪除', value: `\`${deletedCount}\` 則`, inline: true },
          {
            name: '目標',
            value: targetUser ? `<@${targetUser.id}>` : '所有使用者',
            inline: true
          },
          { name: '執行者', value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp()
        .setFooter({
          text: interaction.client.user.username,
          iconURL: interaction.client.user.displayAvatarURL()
        });

      return interaction.editReply({ embeds: [successEmbed] });
    }
    if (sub === '公告') {
      const title = interaction.options.getString('標題');
      const content = interaction.options.getString('內容');
      const colorInput = interaction.options.getString('顏色') || '#3498DB';
      const hexColor = colorInput.startsWith('#') ? colorInput.replace('#', '0x') : `0x${colorInput}`;
      const embed = new EmbedBuilder().setTitle(title).setDescription(content.replace(/\\n/g, '\n')).setColor(parseInt(hexColor) || 0x3498DB).setTimestamp();
      await interaction.options.getChannel('頻道').send({ embeds: [embed] });
      return interaction.reply({ content: `✅ 公告已發送。`, flags: MessageFlags.Ephemeral });
    }

    // MC Status auto refresh (from settings.js)
    // This function needs to be called from bot.js client.once('clientReady')
    // I'll add it to the module.exports of management.js and update bot.js
  },

  // Moved from settings.js
  startAutoRefresh: function(client) {
    if (global.statusRefreshInterval) {
      clearInterval(global.statusRefreshInterval);
    }

    global.statusRefreshInterval = setInterval(async () => {
      const doc = await loadDocument('system_configs', 'statusChannel');
      const configs = doc?.data || doc || {};
      for (const guildId in configs) {
        const config = configs[guildId];
        if (!config.channelId || !config.messageId || !config.domain) continue;

        try {
          const ch = await client.channels.fetch(config.channelId).catch(() => null);
          if (!ch) continue;
          const message = await ch.messages.fetch(config.messageId).catch(() => null);
          if (!message) continue;

          const embed = await module.exports.buildEmbed(config.domain);
          await message.edit({ embeds: [embed] }).catch(() => {});
        } catch (err) {
          console.warn(`[MC Status] Failed to refresh guild ${guildId}:`, err.message);
        }
      }
    }, 300000); // 5分鐘
    console.log("✔ 狀態刷新器已恢復 (多伺服器模式)");
  },

  // Moved from settings.js
  buildEmbed: async function(domain) {
    const fetch = globalThis.fetch || require('node-fetch');

    try {
      const res = await fetch(`https://api.mcstatus.io/v2/status/java/${domain}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const online = data?.online;
      const players = data?.players;
      const widget = `https://api.mcstatus.io/v2/widget/java/${domain}?dark=true&rounded=false`;

      return new EmbedBuilder()
        .setTitle("☁️ 伺服器即時狀態")
        .setColor(online ? 0x3BA9FF : 0xFF4B4B)
        .addFields(
          { name: "📡 狀態", value: online ? "🟢 在線" : "🔴 離線", inline: true },
          { name: "👥 玩家", value: online ? `${players?.online ?? 0}/${players?.max ?? 0}` : "N/A", inline: true },
          { name: "🌍 IP", value: `\`${domain}\``, inline: false }
        )
        .setImage(widget)
        .setTimestamp();
    } catch (err) {
      return new EmbedBuilder()
        .setTitle("☁️ 伺服器即時狀態")
        .setColor(0xFF4B4B)
        .setDescription(`# ⚠️ API 異常\nmcstatus.io 暫時拒絕請求或回傳格式錯誤。`)
        .setTimestamp();
    }
  }
};