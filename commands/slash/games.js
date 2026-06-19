const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags
} = require('discord.js');

const fs = require('fs').promises;
const path = require('path');

// === 2048 遊戲邏輯 ===
class Game2048 {
  constructor(size = 4) {
    this.size = size;
    this.board = Array.from({ length: size }, () => Array(size).fill(0));
    this.score = 0;
    this.addRandomTile();
    this.addRandomTile();
  }
  cloneBoard() { return this.board.map(r => r.slice()); }
  addRandomTile() {
    const empties = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.board[r][c] === 0) empties.push([r, c]);
    if (empties.length === 0) return false;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }
  static compressAndMergeRowLeft(row) {
    const nonZero = row.filter(x => x !== 0);
    const merged = [];
    let scoreGain = 0;
    for (let i = 0; i < nonZero.length; i++) {
      if (nonZero[i] === nonZero[i + 1]) {
        const val = nonZero[i] * 2;
        merged.push(val);
        scoreGain += val;
        i++;
      } else { merged.push(nonZero[i]); }
    }
    while (merged.length < row.length) merged.push(0);
    return { row: merged, scoreGain };
  }
  move(direction) {
    let board = this.cloneBoard();
    let totalGain = 0;
    let moved = false;
    const doLeft = b => {
      for (let r = 0; r < this.size; r++) {
        const { row, scoreGain } = Game2048.compressAndMergeRowLeft(b[r]);
        if (!arraysEqual(row, b[r])) moved = true;
        b[r] = row;
        totalGain += scoreGain;
      }
    };
    const transpose = m => m[0].map((_, c) => m.map(r => r[c]));
    if (direction === 'left') doLeft(board);
    else if (direction === 'right') { board = board.map(row => row.slice().reverse()); doLeft(board); board = board.map(row => row.slice().reverse()); }
    else if (direction === 'up') { board = transpose(board); doLeft(board); board = transpose(board); }
    else if (direction === 'down') { board = transpose(board); board = board.map(row => row.slice().reverse()); doLeft(board); board = board.map(row => row.slice().reverse()); board = transpose(board); }
    if (moved) { this.board = board; this.score += totalGain; this.addRandomTile(); return true; }
    return false;
  }
  canMove() {
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (this.board[r][c] === 0) return true;
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
      const v = this.board[r][c];
      if (r + 1 < this.size && this.board[r + 1][c] === v) return true;
      if (c + 1 < this.size && this.board[r][c + 1] === v) return true;
    }
    return false;
  }
  boardToCodeBlock() {
    let maxNum = 4;
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) maxNum = Math.max(maxNum, String(this.board[r][c]).length);
    const lines = this.board.map(row => row.map(n => (n === 0 ? '.'.repeat(maxNum) : String(n).padStart(maxNum, ' '))).join(' | '));
    return '```\n' + lines.join('\n') + '\n```';
  }
}

function arraysEqual(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

// === 輔助函數 ===
function drawCard() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = [{n:"A",v:11},{n:"2",v:2},{n:"3",v:3},{n:"4",v:4},{n:"5",v:5},{n:"6",v:6},{n:"7",v:7},{n:"8",v:8},{n:"9",v:9},{n:"10",v:10},{n:"J",v:10},{n:"Q",v:10},{n:"K",v:10}];
  const r = ranks[Math.floor(Math.random()*ranks.length)];
  const s = suits[Math.floor(Math.random()*suits.length)];
  return { text: `${r.n}${s}`, value: r.v, isAce: r.n === "A" };
}
function calcBJScore(hand) {
  let score = hand.reduce((acc, c) => acc + c.value, 0);
  let aces = hand.filter(c => c.isAce).length;
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("遊戲")
    .setDescription("白雲娛樂中心 - 各種有趣的小遊戲")
    .addSubcommand(sub => sub.setName("2048").setDescription("經典 2048 遊戲"))
    .addSubcommand(sub => sub.setName("猜拳").setDescription("來跟白雲玩剪刀石頭布！"))
    .addSubcommand(sub => sub.setName("拉霸機").setDescription("試試手氣！"))
    .addSubcommand(sub => sub.setName("數字炸彈").setDescription("終極密碼，看誰踩到炸彈"))
    .addSubcommand(sub => sub.setName("21點").setDescription("撲克 21 點對決"))
    .addSubcommand(sub => sub.setName("1a2b").setDescription("益智猜數字遊戲"))
    .addSubcommand(sub => sub.setName("20問").setDescription("白雲想一個東西，你來猜！")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.user;

    // === 2048 ===
    if (sub === "2048") {
      const game = new Game2048();
      const embed = new EmbedBuilder().setTitle("2048").setDescription(game.boardToCodeBlock()).setFooter({ text: `分數：${game.score}` }).setColor(0x3BA9FF);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("up").setEmoji("⬆️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("down").setEmoji("⬇️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("left").setEmoji("⬅️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("right").setEmoji("➡️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("quit").setEmoji("❌").setStyle(ButtonStyle.Danger)
      );
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 600000 });
      collector.on("collect", async i => {
        await i.deferUpdate();
        if (i.customId === "quit") return collector.stop("quit");
        game.move(i.customId);
        if (!game.canMove()) return collector.stop("dead");
        await msg.edit({ embeds: [new EmbedBuilder().setTitle("2048").setDescription(game.boardToCodeBlock()).setFooter({ text: `分數：${game.score}` }).setColor(0x3BA9FF)] });
      });
      collector.on("end", (_, reason) => {
        interaction.editReply({ content: `遊戲結束！最終分數：${game.score}`, components: [] });
      });
      return;
    }

    // === 猜拳 ===
    if (sub === "猜拳") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rock").setEmoji("✊").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("paper").setEmoji("✋").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("scissors").setEmoji("✌️").setStyle(ButtonStyle.Danger)
      );
      const embed = new EmbedBuilder().setTitle("✌️ 剪刀、石頭、布！").setDescription("請出拳：").setColor(0x3498db);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const i = await msg.awaitMessageComponent({ filter: i => i.user.id === user.id, time: 30000 }).catch(() => null);
      if (!i) return interaction.editReply({ content: "⏳ 猜拳超時囉！", components: [] });
      const choices = ["rock", "paper", "scissors"];
      const botChoice = choices[Math.floor(Math.random() * 3)];
      const playerChoice = i.customId;
      let res = "";
      if (playerChoice === botChoice) res = "🤝 平手！";
      else if ((playerChoice==="rock" && botChoice==="scissors") || (playerChoice==="paper" && botChoice==="rock") || (playerChoice==="scissors" && botChoice==="paper")) res = "🎉 你贏了！";
      else res = "😝 我贏了！";
      return i.update({ embeds: [new EmbedBuilder().setTitle(res).setDescription(`你出了 ${playerChoice}，我出了 ${botChoice}`).setColor(0x00FF00)], components: [] });
    }

    // === 20問 ===
    if (sub === "20問") {
      const secrets = ['月亮', '咖啡', '雲朵', '手機', '星星', '森林', '海洋'];
      const secret = secrets[Math.floor(Math.random() * secrets.length)];
      const embed = new EmbedBuilder().setTitle('🎮 20 問遊戲').setDescription(`我已經想好了一個東西，你有 20 次機會問我「是/否」的問題來猜它！\n\n**提示：** 第一個字是「${secret[0]}」`).setColor(0x8B7AFF);
      return interaction.reply({ embeds: [embed] });
    }
    
    // ... 其他遊戲邏輯簡化移植 ...
    return interaction.reply({ content: "此遊戲功能正在維護中，請稍後再試！", flags: MessageFlags.Ephemeral });
  }
};
