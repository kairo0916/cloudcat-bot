const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs/promises");
const path = require("path");

// ============================================================
// 隨機顏色
// ============================================================
function randomEmbedColor() {
  return Math.floor(Math.random() * 0xffffff);
}

// ============================================================
// 讀取排行榜資料
// ============================================================
async function loadRecords() {
  const file = path.resolve(__dirname, "../../data/system/2048_point.json");

  // 若資料夾 / 檔案不存在 → 自動建立
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "{}", "utf8");
  }

  let record = {};
  try {
    record = JSON.parse(await fs.readFile(file, "utf8"));
    if (!record || typeof record !== "object" || Array.isArray(record)) record = {};
  } catch {
    record = {};
  }

  return record;
}

// ============================================================
// Slash command
// ============================================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("2048排行榜")
    .setDescription("查看 2048 前 5 名排行榜！"),

  async execute(interaction) {
    await interaction.deferReply();

    const record = await loadRecords();
    const entries = Object.entries(record);

    // 如果沒半個人玩過
    if (entries.length === 0) {
      return interaction.editReply("還沒有任何人玩過 2048 喔～試著當第一名吧！ (ﾉ>ω<)ﾉ");
    }

    // 排序：分數由大到小
    const sorted = entries
      .map(([userId, info]) => ({
        userId,
        username: info.username,
        score: info.score || 0,
        time: info.time || "未知時間"
      }))
      .sort((a, b) => b.score - a.score);

    const top5 = sorted.slice(0, 5);

    // 找使用者排名
    const myIndex = sorted.findIndex(e => e.userId === interaction.user.id);
    const myRank = myIndex === -1 ? "未上榜" : myIndex + 1;

    // ------------------------------------------------------------
    // 權重顯示圖示（按照你給的排序）
    // ------------------------------------------------------------
    const icons = ["🏆", "🏅", "🥇", "🥈", "🥉"];

    let desc = top5
      .map((p, idx) => {
        const icon = icons[idx] || "•";
        return `${icon} — <@${p.userId}>　(${p.score})`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("2048 TOP5 排行榜")
      .setDescription(desc)
      .setColor(randomEmbedColor())
      .setFooter({
        text: `總：${entries.length} 筆  | 你的排名：${myRank}`
      });

    // 送出
    return interaction.editReply({ embeds: [embed] });
  }
};