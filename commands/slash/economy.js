const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const gameData = require('../../utils/gameData.js');
const { loadDocument, saveDocument } = require('../../utils/mongodb');

// === 碎片系統輔助函數 ===
async function loadShards() {
  const doc = await loadDocument('system_configs', 'daily_sign');
  return doc?.data || doc || { users: {} };
}
async function saveShards(data) {
  const toSave = { ...data };
  delete toSave._id;
  await saveDocument('system_configs', 'daily_sign', toSave);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('經濟')
    .setDescription('白雲金融中心 - 管理你的財富與獎勵')
    .addSubcommand(sub => sub.setName('查詢').setDescription('查詢你的金幣與物品'))
    .addSubcommand(sub => sub.setName('每日領取').setDescription('領取每日金幣獎勵'))
    .addSubcommand(sub => sub.setName('轉帳').setDescription('轉帳金幣給朋友')
      .addUserOption(opt => opt.setName('對象').setDescription('接收金幣的用戶').setRequired(true))
      .addIntegerOption(opt => opt.setName('金額').setDescription('轉帳金額').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('排行榜').setDescription('查看全服財富排行榜'))
    .addSubcommand(sub => sub.setName('工作').setDescription('努力工作賺取金幣'))
    .addSubcommand(sub => sub.setName('乞討').setDescription('在街頭乞討，試試運氣'))
    .addSubcommand(sub => sub.setName('賭博').setDescription('高風險擲骰子賭博').addIntegerOption(o=>o.setName('下注金額').setDescription('要賭多少金幣').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('猜硬幣').setDescription('猜正反面，贏了獎金翻倍').addStringOption(o=>o.setName('猜測').setDescription('正面或反面').setRequired(true).addChoices({name:'正面',value:'正'},{name:'反面',value:'反'})).addIntegerOption(o=>o.setName('下注金額').setDescription('金額').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('存錢').setDescription('將身上的金幣存入銀行').addIntegerOption(o=>o.setName('金額').setDescription('要存入的金額').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('提款').setDescription('從銀行提出金幣').addIntegerOption(o=>o.setName('金額').setDescription('要提出的金額').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('買彩券').setDescription('花費 100 金幣購買彩券，極低機率中大獎'))
    .addSubcommand(sub => sub.setName('投資').setDescription('投資虛擬股市').addIntegerOption(o=>o.setName('金額').setDescription('投資金額').setRequired(true).setMinValue(100)))
    .addSubcommand(sub => sub.setName('挖礦').setDescription('進入礦坑挖礦尋寶'))
    .addSubcommand(sub => sub.setName('釣魚').setDescription('去河邊釣魚'))
    .addSubcommandGroup(group => group.setName('碎片').setDescription('碎片系統')
      .addSubcommand(sub => sub.setName('兌換').setDescription('使用碎片兌換獎勵')
        .addStringOption(opt => opt.setName('玩家').setDescription('遊戲 ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('金額').setDescription('兌換金額').setRequired(true))
      )
      .addSubcommand(sub => sub.setName('排行').setDescription('查看碎片排行榜'))
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // === 金幣查詢 ===
    if (sub === '查詢') {
      const data = await gameData.getOrCreateUserData(userId);
      const coins = data.coins || 0;
      const bank = data.bank || 0;
      const items = await gameData.getItems(userId);
      const embed = new EmbedBuilder().setTitle('💰 個人資產查詢').setColor(0x2ecc71)
        .addFields({ name: '現金餘額', value: `\`${coins}\` 💰`, inline: true }, { name: '銀行存款', value: `\`${bank}\` 🏦`, inline: true }, { name: '總資產', value: `\`${coins + bank}\` 💎`, inline: true }, { name: '擁有物品', value: `\`${items.length}\` 件`, inline: false })
        .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
      return interaction.editReply({ embeds: [embed] });
    }

    // === 每日領取 ===
    if (sub === '每日領取') {
      const data = await gameData.getOrCreateUserData(userId);
      const today = new Date().toDateString();
      if (data.lastDailyReward === today) return interaction.editReply({ content: '❌ 今天已經領過了唷！明天再來吧～' });
      const reward = Math.floor(Math.random() * 101) + 50;
      data.coins = (data.coins || 0) + reward;
      data.lastDailyReward = today;
      await gameData.saveUserData(userId, data);
      return interaction.editReply({ content: `✅ 領取成功！獲得了 \`${reward}\` 💰` });
    }

    // === 轉帳 ===
    if (sub === '轉帳') {
      const target = interaction.options.getUser('對象');
      const amount = interaction.options.getInteger('金額');
      if (userId === target.id) return interaction.editReply({ content: '❌ 不能轉帳給自己喔！' });
      const myCoins = await gameData.getCoins(userId);
      if (myCoins < amount) return interaction.editReply({ content: `❌ 現金不足！你身上只有 \`${myCoins}\` 💰` });
      await gameData.addCoins(userId, -amount);
      await gameData.addCoins(target.id, amount);
      return interaction.editReply({ content: `✅ 成功轉帳 \`${amount}\` 💰 給 <@${target.id}>！` });
    }

    // === 財富排行 ===
    if (sub === '排行榜') {
      const top = await gameData.getTopUsers(10);
      let desc = '';
      for (let i = 0; i < top.length; i++) {
        const u = top[i];
        desc += `\`#${i+1}\` <@${u.userId}> - 總資產: \`${(u.coins||0) + (u.bank||0)}\` 💰\n`;
      }
      const embed = new EmbedBuilder().setTitle('🏆 財富排行榜 (Top 10)').setDescription(desc || '暫無數據').setColor(0xFFD700);
      return interaction.editReply({ embeds: [embed] });
    }

    // === 新增：工作 ===
    if (sub === '工作') {
      const data = await gameData.getOrCreateUserData(userId);
      const now = Date.now();
      if (data.lastWork && now - data.lastWork < 3600000) {
        const left = Math.ceil((3600000 - (now - data.lastWork)) / 60000);
        return interaction.editReply({ content: `💦 你太累了，請休息 \`${left}\` 分鐘後再工作。` });
      }
      const earn = Math.floor(Math.random() * 200) + 50;
      data.coins = (data.coins || 0) + earn;
      data.lastWork = now;
      const jobs = ['幫村長劈柴', '在酒吧打工', '幫騎士保養盔甲', '當了一天外送員', '寫了一段完美的程式碼'];
      await gameData.saveUserData(userId, data);
      return interaction.editReply({ content: `🛠️ 你${jobs[Math.floor(Math.random()*jobs.length)]}，賺到了 \`${earn}\` 💰！` });
    }

    // === 新增：乞討 ===
    if (sub === '乞討') {
      const data = await gameData.getOrCreateUserData(userId);
      const now = Date.now();
      if (data.lastBeg && now - data.lastBeg < 600000) {
        return interaction.editReply({ content: `🚓 警察在附近巡邏，等 \`${Math.ceil((600000-(now-data.lastBeg))/60000)}\` 分鐘後再來乞討吧。` });
      }
      data.lastBeg = now;
      if (Math.random() > 0.5) {
        const earn = Math.floor(Math.random() * 30) + 1;
        data.coins = (data.coins || 0) + earn;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🥺 路人覺得你可憐，給了你 \`${earn}\` 💰。` });
      } else {
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `💨 路人無視了你，你什麼也沒拿到。` });
      }
    }

    // === 新增：賭博 ===
    if (sub === '賭博') {
      const amount = interaction.options.getInteger('下注金額');
      const data = await gameData.getOrCreateUserData(userId);
      if ((data.coins || 0) < amount) return interaction.editReply({ content: `❌ 現金不足！你只有 \`${data.coins||0}\` 💰` });
      
      const win = Math.random() > 0.55; // 莊家優勢
      if (win) {
        data.coins += amount;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🎲 骰子轉動... 🎉 **你贏了！** 獲得 \`${amount * 2}\` 💰 (淨賺 ${amount})` });
      } else {
        data.coins -= amount;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🎲 骰子轉動... ❌ **你輸了！** 失去了 \`${amount}\` 💰` });
      }
    }

    // === 新增：猜硬幣 ===
    if (sub === '猜硬幣') {
      const guess = interaction.options.getString('猜測');
      const amount = interaction.options.getInteger('下注金額');
      const data = await gameData.getOrCreateUserData(userId);
      if ((data.coins || 0) < amount) return interaction.editReply({ content: `❌ 現金不足！你只有 \`${data.coins||0}\` 💰` });
      
      const result = Math.random() > 0.5 ? '正' : '反';
      if (guess === result) {
        data.coins += amount;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🪙 硬幣拋出... 是 **${result}面**！\n🎉 **你猜對了！** 獲得 \`${amount * 2}\` 💰` });
      } else {
        data.coins -= amount;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🪙 硬幣拋出... 是 **${result}面**！\n❌ **你猜錯了！** 失去了 \`${amount}\` 💰` });
      }
    }

    // === 新增：存錢 & 提款 ===
    if (sub === '存錢' || sub === '提款') {
      const amount = interaction.options.getInteger('金額');
      const data = await gameData.getOrCreateUserData(userId);
      data.coins = data.coins || 0;
      data.bank = data.bank || 0;

      if (sub === '存錢') {
        if (data.coins < amount) return interaction.editReply({ content: `❌ 現金不足！你只有 \`${data.coins}\` 💰` });
        data.coins -= amount; data.bank += amount;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🏦 成功將 \`${amount}\` 存入銀行！\n目前銀行存款：\`${data.bank}\` 🏦` });
      } else {
        if (data.bank < amount) return interaction.editReply({ content: `❌ 存款不足！你銀行只有 \`${data.bank}\` 🏦` });
        data.bank -= amount; data.coins += amount;
        await gameData.saveUserData(userId, data);
        return interaction.editReply({ content: `🏦 成功從銀行提出 \`${amount}\`！\n目前現金：\`${data.coins}\` 💰` });
      }
    }

    // === 新增：買彩券 ===
    if (sub === '買彩券') {
      const data = await gameData.getOrCreateUserData(userId);
      if ((data.coins || 0) < 100) return interaction.editReply({ content: `❌ 現金不足！買彩券需要 \`100\` 💰` });
      data.coins -= 100;
      
      const r = Math.random();
      let msg = '';
      if (r < 0.01) { data.coins += 10000; msg = `🎉 **中頭獎啦！** 獲得 \`10000\` 💰！`; }
      else if (r < 0.1) { data.coins += 500; msg = `🎊 **中二獎！** 獲得 \`500\` 💰！`; }
      else if (r < 0.3) { data.coins += 100; msg = `✨ **普獎！** 回本 \`100\` 💰。`; }
      else { msg = `💨 刮開彩券... **銘謝惠顧**！`; }
      
      await gameData.saveUserData(userId, data);
      return interaction.editReply({ content: `🎫 你花費 100 💰 買了一張彩券。\n${msg}` });
    }

    // === 新增：投資 ===
    if (sub === '投資') {
      const amount = interaction.options.getInteger('金額');
      const data = await gameData.getOrCreateUserData(userId);
      if ((data.coins || 0) < amount) return interaction.editReply({ content: `❌ 現金不足！` });
      
      data.coins -= amount;
      const returnRate = (Math.random() * 2) - 0.5; // -50% to +150%
      const finalReturn = Math.floor(amount * returnRate);
      data.coins += finalReturn;
      
      await gameData.saveUserData(userId, data);
      if (finalReturn > amount) return interaction.editReply({ content: `📈 你投資了 ${amount}，股市大漲！最終收回 \`${finalReturn}\` 💰 (淨賺 ${finalReturn - amount})` });
      else return interaction.editReply({ content: `📉 你投資了 ${amount}，股市慘跌...最終只拿回 \`${finalReturn}\` 💰 (虧損 ${amount - finalReturn})` });
    }

    // === 新增：挖礦 ===
    if (sub === '挖礦') {
      const data = await gameData.getOrCreateUserData(userId);
      const now = Date.now();
      if (data.lastMine && now - data.lastMine < 1800000) return interaction.editReply({ content: `⛏️ 十字鎬需要修理，請 \`${Math.ceil((1800000-(now-data.lastMine))/60000)}\` 分鐘後再來。` });
      
      data.lastMine = now;
      const ores = [{name:'石頭', val:5, p:0.5},{name:'煤炭', val:20, p:0.3},{name:'鐵礦', val:80, p:0.15},{name:'鑽石', val:500, p:0.05}];
      const r = Math.random();
      let sum = 0, got = ores[0];
      for (const o of ores) { sum += o.p; if (r < sum) { got = o; break; } }
      
      data.coins = (data.coins || 0) + got.val;
      await gameData.saveUserData(userId, data);
      return interaction.editReply({ content: `⛏️ 叮叮噹噹... 哇！你挖到了 **${got.name}**！賣出了 \`${got.val}\` 💰！` });
    }

    // === 新增：釣魚 ===
    if (sub === '釣魚') {
      const data = await gameData.getOrCreateUserData(userId);
      const now = Date.now();
      if (data.lastFish && now - data.lastFish < 1800000) return interaction.editReply({ content: `🎣 魚群被嚇跑了，請 \`${Math.ceil((1800000-(now-data.lastFish))/60000)}\` 分鐘後再來。` });
      
      data.lastFish = now;
      const fishes = [{n:'破河靴', v:1, p:0.3},{n:'小金魚', v:30, p:0.4},{n:'大黑鯛', v:100, p:0.2},{n:'傳說中的黃金錦鯉', v:1000, p:0.1}];
      const r = Math.random();
      let sum = 0, got = fishes[0];
      for (const f of fishes) { sum += f.p; if (r < sum) { got = f; break; } }
      
      data.coins = (data.coins || 0) + got.v;
      await gameData.saveUserData(userId, data);
      return interaction.editReply({ content: `🎣 拋出釣竿... 咬餌了！\n你釣到了 **${got.n}**！賣出了 \`${got.v}\` 💰！` });
    }

    // === 碎片系統 ===
    if (group === '碎片') {
      const shardData = await loadShards();
      if (sub === '兌換') {
        const player = interaction.options.getString('玩家');
        const amount = interaction.options.getInteger('金額');
        const userShards = shardData.users?.[userId]?.shards || 0;
        const cost = Math.floor((amount / 100) * 30);
        if (userShards < cost) return interaction.editReply({ content: `❌ 碎片不足！你需要 ${cost} 碎片，但目前只有 ${userShards}。` });
        return interaction.editReply({ content: `✅ 已排程兌換 \`${amount}\` 元至帳號 \`${player}\`！` });
      }
      if (sub === '排行') {
        const list = Object.entries(shardData.users || {}).sort((a,b)=>(b[1].shards||0)-(a[1].shards||0)).slice(0,10).map((v,i)=>`\`#${i+1}\` <@${v[0]}> - \`${v[1].shards||0}\` 💠`).join('\n');
        const embed = new EmbedBuilder().setTitle('💠 碎片排行榜').setDescription(list || '暫無數據').setColor(0x3BA9FF);
        return interaction.editReply({ embeds: [embed] });
      }
    }
  }
};
