const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { loadDocument, saveDocument } = require('../../utils/mongodb');

async function loadData() {
  let doc = await loadDocument('system_configs', 'daily_sign');
  let data = doc ? (doc.data || doc) : { users: {} };
  
  if (!data.users) data.users = {};

  for (const id in data.users) {
    const u = data.users[id];
    if (typeof u.shards !== 'number') u.shards = 0;
    if (typeof u.total !== 'number') u.total = 0;
    if (typeof u.streak !== 'number') u.streak = 0;
    if (!u.last) u.last = null;
    if (u.lastSign) {
      u.last = u.lastSign;
      delete u.lastSign;
    }
  }

  return data;
}

async function saveData(data) {
  const toSave = { ...data };
  delete toSave._id;
  await saveDocument('system_configs', 'daily_sign', toSave);
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function reward() {
  return Math.floor(Math.random() * 5) + 1;
}

async function sign(userId) {
  const data = await loadData();

  if (!data.users[userId]) {
    data.users[userId] = {
      last: null,
      streak: 0,
      total: 0,
      shards: 0
    };
  }

  const u = data.users[userId];

  u.shards = u.shards ?? 0;
  u.total = u.total ?? 0;
  u.streak = u.streak ?? 0;

  const t = today();

  if (u.last === t) {
    return { ok: false, error: "你今天已經簽到過了" };
  }

  const y = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  })();

  u.streak = (u.last === y) ? u.streak + 1 : 1;
  u.last = t;
  u.total += 1;

  const r = reward();
  u.shards = (u.shards ?? 0) + r;

  await saveData(data);

  return {
    ok: true,
    reward: r,
    streak: u.streak,
    total: u.total,
    shards: u.shards
  };
}

async function stats(userId) {
  const data = await loadData();
  const u = data.users[userId];

  if (!u) return { total: 0, streak: 0, shards: 0 };

  return {
    total: u.total ?? 0,
    streak: u.streak ?? 0,
    shards: u.shards ?? 0
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('每日簽到')
    .setDescription('每日簽到系統')
    .addSubcommand(s => s.setName('簽到').setDescription('進行今天的每日簽到'))
    .addSubcommand(s => s.setName('簽到天數').setDescription('查看你的簽到總天數與紀錄')),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === "簽到") {
      const r = await sign(interaction.user.id);

      const e = new EmbedBuilder().setTitle("每日簽到").setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

      if (!r.ok) {
        e.setColor(0xff4b4b).setDescription(`✖ ${r.error}`);
        return interaction.editReply({ embeds: [e] });
      }

      e.setColor(0x3ba9ff).setDescription(
        `✔ 簽到成功! 獲得 ${r.reward} 個碎片!\n🔥 連續：${r.streak}\n📊 總計：${r.total}\n💠 碎片：${r.shards}`
      );

      return interaction.editReply({ embeds: [e] });
    }

    if (sub === "簽到天數") {
      const s = await stats(interaction.user.id);

      const e = new EmbedBuilder()
        .setTitle("簽到紀錄")
        .setColor(0x3ba9ff)
        .setDescription(
          `✔ 總簽到：${s.total} 天\n✔ 連續：${s.streak} 天\n💠 碎片：${s.shards}`
        );

      return interaction.editReply({ embeds: [e] });
    }
  }
};
