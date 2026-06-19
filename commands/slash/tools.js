const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { URL } = require('url');
const fetch = globalThis.fetch || require('node-fetch');
const gameData = require('../../utils/gameData.js');
const crypto = require('crypto');
const moment = require('moment-timezone');
require('dotenv').config();

// === 翻譯資料庫 ===
const translations = {
  'hello': { zh: '哈囉', ja: 'こんにちは' },
  'goodbye': { zh: '再見', ja: 'さようなら' },
  'thank you': { zh: '謝謝', ja: 'ありがとう' },
  'sorry': { zh: '抱歉', ja: 'ごめん' },
  'love': { zh: '愛', ja: '愛' },
  'friend': { zh: '朋友', ja: '友達' },
  'happy': { zh: '快樂', ja: '楽しい' },
  'sad': { zh: '難過', ja: '悲しい' },
  'cloud': { zh: '雲', ja: '雲' },
  'sky': { zh: '天空', ja: '空' },
  'night': { zh: '晚上', ja: '夜' },
  'day': { zh: '白天', ja: '昼' },
  'water': { zh: '水', ja: '水' },
  'fire': { zh: '火', ja: '火' },
  'earth': { zh: '土地', ja: '地球' },
  'help': { zh: '幫助', ja: '助け' },
  'yes': { zh: '是', ja: 'はい' },
  'no': { zh: '否', ja: 'いいえ' },
  'good': { zh: '好', ja: 'いい' },
  'bad': { zh: '壞', ja: '悪い' },
  '你好': { en: 'Hello', ja: 'こんにちは' },
  '謝謝': { en: 'Thank you', ja: 'ありがとう' },
  '再見': { en: 'Goodbye', ja: 'さようなら' },
  '白雲': { en: 'White Cloud', ja: 'ホワイトクラウド' },
  '愛': { en: 'Love', ja: '愛' },
  '朋友': { en: 'Friend', ja: '友達' }
};

// === 網址檢查工具 ===
function isIpHost(hostname) { return /^[0-9.]+$/.test(hostname) || /^\[?[0-9a-fA-F:]+\]?$/.test(hostname); }
function parseSetCookieHeaders(headers) {
  const cookies = []; let raw = [];
  if (typeof headers.getSetCookie === 'function') raw = headers.getSetCookie();
  else if (headers.raw && headers.raw()['set-cookie']) raw = headers.raw()['set-cookie'];
  else if (headers.get && headers.get('set-cookie')) raw = String(headers.get('set-cookie')).split(/,(?=[^;]+=)/);
  if (!raw || raw.length === 0) return cookies;
  const arr = Array.isArray(raw) ? raw : [raw];
  for (const c of arr) {
    const parts = c.split(';').map(s => s.trim().toLowerCase());
    cookies.push({ raw: c, secure: parts.includes('secure'), httponly: parts.includes('httponly'), samesite: parts.find(x => x.startsWith('samesite='))?.split('=')[1] || null });
  }
  return cookies;
}
async function analyzeUrl(inputUrl) {
  const result = { score: 100, pass: [], fail: [], notes: [], meta: {} };
  let url;
  try {
    if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(inputUrl)) inputUrl = 'https://' + inputUrl;
    url = new URL(inputUrl);
  } catch (e) { result.score = 0; result.fail.push('無效的 URL 格式'); return result; }
  result.meta.url = url.href; result.meta.hostname = url.hostname;
  if (isIpHost(url.hostname)) { result.fail.push('主機為 IP 位址'); result.score -= 20; } else result.pass.push('主機非 IP');
  const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url.href, { method: 'GET', redirect: 'follow', signal: controller.signal });
    result.meta.status = `${resp.status} ${resp.statusText || ''}`.trim();
    if (resp.ok) result.pass.push(`HTTP 回應狀態 ${resp.status}`); else { result.fail.push(`HTTP 回應狀態 ${resp.status}`); result.score -= 10; }
    const headers = resp.headers;
    if (headers.get('strict-transport-security')) result.pass.push('有 HSTS'); else { result.fail.push('缺少 HSTS'); result.score -= 10; }
    const cookies = parseSetCookieHeaders(headers); result.meta.cookies = cookies;
    if (cookies.length > 0) {
      if (cookies.some(c => !c.secure || !c.httponly)) { result.fail.push('有 cookie 未標記為 Secure/HttpOnly'); result.score -= 6; } else result.pass.push('Cookie 安全設置良好');
    }
  } catch (e) { result.fail.push('無法連線或逾時'); result.score -= 40; } finally { clearTimeout(timeoutId); }
  result.score = Math.max(0, Math.min(100, result.score)); return result;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('工具')
    .setDescription('各式各樣的實用小工具 (10項功能)')
    .addSubcommand(sub => sub.setName('翻譯').setDescription('多語言翻譯')
      .addStringOption(opt => opt.setName('源語言').setDescription('原文語言').setRequired(true).addChoices({name:'英文',value:'en'},{name:'中文',value:'zh'},{name:'日文',value:'ja'}))
      .addStringOption(opt => opt.setName('目標語言').setDescription('目標語言').setRequired(true).addChoices({name:'英文',value:'en'},{name:'中文',value:'zh'},{name:'日文',value:'ja'}))
      .addStringOption(opt => opt.setName('文字').setDescription('要翻譯的文字').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('隨機梗圖').setDescription('隨機獲取一張趣味梗圖'))
    .addSubcommand(sub => sub.setName('網址檢查').setDescription('檢查網址安全性').addStringOption(opt => opt.setName('網址').setDescription('要檢查的網址').setRequired(true)))
    .addSubcommand(sub => sub.setName('天氣').setDescription('查詢指定城市天氣 (需配置 API Key)').addStringOption(opt => opt.setName('城市').setDescription('要查詢的城市名稱 (英文)').setRequired(true)))
    .addSubcommand(sub => sub.setName('密碼生成').setDescription('生成高強度的安全密碼').addIntegerOption(opt => opt.setName('長度').setDescription('密碼長度 (8-32)').setRequired(false).setMinValue(8).setMaxValue(32)))
    .addSubcommand(sub => sub.setName('qr碼').setDescription('生成 QR Code').addStringOption(opt => opt.setName('內容').setDescription('文字或網址').setRequired(true)))
    .addSubcommand(sub => sub.setName('短網址').setDescription('將冗長網址縮短').addStringOption(opt => opt.setName('網址').setDescription('原始網址').setRequired(true)))
    .addSubcommand(sub => sub.setName('字數統計').setDescription('精確統計文字數量').addStringOption(opt => opt.setName('文字').setDescription('要統計的文字').setRequired(true)))
    .addSubcommand(sub => sub.setName('笑話').setDescription('為你講個真實隨機笑話 (透過 API)'))
    .addSubcommand(sub => sub.setName('base64').setDescription('Base64 編碼/解碼')
      .addStringOption(opt => opt.setName('模式').setDescription('選擇模式').setRequired(true).addChoices({name:'編碼 (Encode)',value:'enc'},{name:'解碼 (Decode)',value:'dec'}))
      .addStringOption(opt => opt.setName('文字').setDescription('輸入字串').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('時間').setDescription('查詢各國當前真實時間').addStringOption(opt => opt.setName('地區').setDescription('選擇地區').setRequired(true).addChoices(
        {name:'台灣/台北',value:'Asia/Taipei'},{name:'日本/東京',value:'Asia/Tokyo'},{name:'美國/紐約',value:'America/New_York'},{name:'英國/倫敦',value:'Europe/London'}
      ))
    )
    .addSubcommandGroup(group => group.setName('提醒').setDescription('個人提醒功能')
      .addSubcommand(sub => sub.setName('新增').setDescription('新增一個提醒'))
      .addSubcommand(sub => sub.setName('列表').setDescription('查看所有提醒'))
      .addSubcommand(sub => sub.setName('刪除').setDescription('刪除一個提醒').addIntegerOption(opt => opt.setName('id').setDescription('提醒ID').setRequired(true)))
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const user = interaction.user;

    // === 翻譯 ===
    if (sub === '翻譯') {
      await interaction.deferReply();
      const from = interaction.options.getString('源語言'), to = interaction.options.getString('目標語言'), text = interaction.options.getString('文字').toLowerCase();
      if (from === to) return interaction.editReply('❌ 源語言和目標語言不能相同呢～');
      const result = translations[text];
      if (!result || !result[to]) return interaction.editReply(`❌ 我還沒學過如何翻譯「${text}」呢...`);
      const embed = new EmbedBuilder().setColor(0x42D9FF).setTitle('🌐 翻譯助手').addFields({ name: '📖 原文', value: `\`${text}\``, inline: true }, { name: '✨ 翻譯', value: `\`${result[to]}\``, inline: true }).setFooter({ text: process.env.FOOTER });
      return interaction.editReply({ embeds: [embed] });
    }

    // === 梗圖 ===
    if (sub === '隨機梗圖') {
      await interaction.deferReply();
      try {
        const res = await fetch('https://some-random-api.com/animal/cat');
        const data = await res.json();
        const embed = new EmbedBuilder().setTitle('喵喵梗圖 😼').setImage(data.image).setColor(0xff9900).setFooter({ text: process.env.FOOTER });
        return interaction.editReply({ embeds: [embed] });
      } catch { return interaction.editReply('🥲 梗圖伺服器抽風了，等下再試吧。'); }
    }

    // === 網址檢查 ===
    if (sub === '網址檢查') {
      await interaction.deferReply();
      const input = interaction.options.getString('網址');
      const analysis = await analyzeUrl(input);
      const embed = new EmbedBuilder().setTitle('網址安全評測報告').setDescription(`\`${analysis.meta.url}\``).setColor(analysis.score >= 80 ? 0x00FF00 : analysis.score >= 60 ? 0xFFFF00 : 0xFF0000).addFields({ name: '安全分數', value: `\`${analysis.score} / 100\``, inline: true }, { name: '主機', value: analysis.meta.hostname, inline: true }).setFooter({ text: process.env.FOOTER });
      return interaction.editReply({ embeds: [embed] });
    }

    // === 天氣 ===
    if (sub === '天氣') {
      await interaction.deferReply();
      const apiKey = process.env.WEATHER_API_KEY;
      if (!apiKey) return interaction.editReply('❌ **系統錯誤：未配置 `WEATHER_API_KEY`。**\n請服主在 `.env` 中設定 WeatherAPI 的金鑰以啟用此真實天氣查詢功能。');
      
      const city = interaction.options.getString('城市');
      try {
        const res = await fetch(`http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`);
        if (!res.ok) throw new Error('API 請求失敗，請確認城市名稱或 API Key。');
        const data = await res.json();
        
        const embed = new EmbedBuilder().setTitle(`⛅ ${data.location.name}, ${data.location.country} 天氣`)
          .setThumbnail(`https:${data.current.condition.icon}`)
          .addFields(
            { name: '氣溫', value: `${data.current.temp_c}°C`, inline: true },
            { name: '體感溫度', value: `${data.current.feelslike_c}°C`, inline: true },
            { name: '濕度', value: `${data.current.humidity}%`, inline: true },
            { name: '風速', value: `${data.current.wind_kph} km/h`, inline: true },
            { name: '狀態', value: data.current.condition.text, inline: true }
          ).setColor(0x3498db).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch (err) { return interaction.editReply(`❌ 天氣查詢失敗：${err.message}`); }
    }

    // === 密碼生成 ===
    if (sub === '密碼生成') {
      const length = interaction.options.getInteger('長度') || 16;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
      let password = '';
      const randomValues = new Uint32Array(length);
      crypto.getRandomValues(randomValues);
      for (let i = 0; i < length; i++) password += chars[randomValues[i] % chars.length];
      return interaction.reply({ content: `🔐 **你的安全密碼：**\n\`\`\`${password}\`\`\``, flags: MessageFlags.Ephemeral });
    }

    // === QR Code ===
    if (sub === 'qr碼') {
      await interaction.deferReply();
      const text = interaction.options.getString('內容');
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
      const embed = new EmbedBuilder().setTitle('📱 QR Code').setImage(url).setColor(0xffffff).setFooter({ text: 'Powered by goqr.me' });
      return interaction.editReply({ embeds: [embed] });
    }

    // === 短網址 ===
    if (sub === '短網址') {
      await interaction.deferReply();
      const url = interaction.options.getString('網址');
      try {
        const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.errorcode) throw new Error(data.errormessage);
        return interaction.editReply(`🔗 **短網址生成成功：**\n${data.shorturl}`);
      } catch (err) { return interaction.editReply(`❌ 短網址生成失敗：${err.message}`); }
    }

    // === 字數統計 ===
    if (sub === '字數統計') {
      const text = interaction.options.getString('文字');
      return interaction.reply({ content: `📝 **字數統計：**\n總字元數（含空白）：\`${text.length}\`\n不含空白字元數：\`${text.replace(/\s+/g, '').length}\``, flags: MessageFlags.Ephemeral });
    }

    // === 笑話 ===
    if (sub === '笑話') {
      await interaction.deferReply();
      try {
        const res = await fetch('https://v2.jokeapi.dev/joke/Any?type=single');
        const data = await res.json();
        if (data.error) throw new Error(data.message);
        return interaction.editReply(`😂 **隨機笑話：**\n${data.joke}`);
      } catch (err) { return interaction.editReply(`❌ 無法獲取笑話：${err.message}`); }
    }

    // === Base64 ===
    if (sub === 'base64') {
      const mode = interaction.options.getString('模式');
      const text = interaction.options.getString('文字');
      try {
        const result = mode === 'enc' ? Buffer.from(text).toString('base64') : Buffer.from(text, 'base64').toString('utf8');
        return interaction.reply({ content: `🔄 **Base64 結果：**\n\`\`\`\n${result}\n\`\`\``, flags: MessageFlags.Ephemeral });
      } catch (err) { return interaction.reply({ content: '❌ 解析失敗', flags: MessageFlags.Ephemeral }); }
    }

    // === 時間 ===
    if (sub === '時間') {
      const tz = interaction.options.getString('地區');
      const time = moment().tz(tz).format('YYYY-MM-DD HH:mm:ss');
      return interaction.reply({ content: `🌍 **${tz} 當前時間：**\n\`${time}\`` });
    }

    // === 提醒邏輯 ===
    if (group === '提醒') {
      if (sub === '新增') {
        const modal = new ModalBuilder().setCustomId(`reminder_${user.id}_${Date.now()}`).setTitle('⏰ 新增提醒');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reminder_name').setLabel('提醒名稱').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reminder_date').setLabel('日期時間 (YYYY-MM-DD HH:mm)').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reminder_message').setLabel('提醒訊息').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        return await interaction.showModal(modal);
      }
      if (sub === '列表') {
        const reminders = await gameData.getReminders(user.id);
        if (reminders.length === 0) return interaction.reply({ content: '❌ 你目前沒有任何提醒', ephemeral: true });
        const text = reminders.map(r => `**ID: ${r.id}** | ${r.name}\n⏰ ${new Date(r.date).toLocaleString('zh-TW')}`).join('\n\n');
        const embed = new EmbedBuilder().setTitle('⏰ 我的提醒').setDescription(text).setColor(0xe67e22);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (sub === '刪除') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const id = interaction.options.getInteger('id');
        await gameData.deleteReminder(user.id, id);
        return interaction.editReply({ content: `✅ 已刪除提醒 (ID: ${id})` });
      }
    }
  }
};