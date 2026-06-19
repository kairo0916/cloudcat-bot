const fs = require('fs-extra');
const path = require('path');
const { loadDocument, saveDocument, getCollection, getCount } = require('./mongodb');

// ========================
// 📂 文件系統訪問工具 (部分保留為唯讀)
// ========================

function getFileList(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    return files.filter(f => !f.startsWith('.')).map(f => ({
      name: f,
      path: path.join(dir, f),
      isDir: fs.statSync(path.join(dir, f)).isDirectory()
    }));
  } catch (e) {
    return [];
  }
}

// ========================
// 👤 用戶信息查詢 (MongoDB 版)
// ========================

async function getUserInfo(userId) {
  try {
    const profile = await loadDocument('user_profiles', userId) || {};
    const memoryDoc = await loadDocument('ai_memories', userId);
    const memory = memoryDoc?.messages || [];

    let userInfo = {
      userId,
      profile,
      conversationCount: memory.length,
      firstSeen: memory.length > 0 ? memory[0].timestamp : null,
      lastActive: memory.length > 0 ? memory[memory.length - 1].timestamp : new Date().toISOString()
    };

    return userInfo;
  } catch (e) {
    return null;
  }
}

async function searchUsersByIdentity(identity) {
  try {
    const col = await getCollection('user_profiles');
    const docs = await col.find({ identity }).toArray();
    return docs.map(doc => ({ profile: doc }));
  } catch (e) {
    return [];
  }
}

async function getTopUsers(limit = 10) {
  try {
    const col = await getCollection('ai_memories');
    // Aggregate to sort by messages length
    const docs = await col.aggregate([
      { $project: { messagesCount: { $size: "$messages" } } },
      { $sort: { messagesCount: -1 } },
      { $limit: limit }
    ]).toArray();

    const users = [];
    for (const doc of docs) {
      const userId = doc._id;
      const profile = await loadDocument('user_profiles', userId) || {};
      users.push({
        userId,
        messageCount: doc.messagesCount,
        identity: profile.identity || '未知',
        intimacy: profile.intimacy || 0
      });
    }
    return users;
  } catch (e) {
    return [];
  }
}

// ========================
// 💾 伺服器統計資訊 (MongoDB 版)
// ========================

async function getServerStats() {
  try {
    const userCount = await getCount('user_profiles');
    const memoryCount = await getCount('ai_memories');
    const configCount = await getCount('system_configs');

    return {
      totalUsers: userCount,
      totalMemories: memoryCount,
      totalConfigs: configCount,
      dbStatus: 'Connected'
    };
  } catch (e) {
    return null;
  }
}

// ========================
// 🔍 搜索功能 (MongoDB 版)
// ========================

async function searchInUserMemory(userId, keyword) {
  try {
    const doc = await loadDocument('ai_memories', userId);
    const memory = doc?.messages || [];
    const results = memory.filter(msg =>
      msg.message.toLowerCase().includes(keyword.toLowerCase())
    );
    return results.slice(-10);
  } catch (e) {
    return [];
  }
}

async function getConversationContext(userId, limit = 5) {
  try {
    const doc = await loadDocument('ai_memories', userId);
    const memory = doc?.messages || [];
    return memory.slice(-limit);
  } catch (e) {
    return [];
  }
}

// ========================
// 🛠️ Cohere 上下文構建器 (MongoDB 版)
// ========================

async function buildCohereContext(userId, additionalInfo = {}) {
  const userInfo = await getUserInfo(userId);
  const serverStats = await getServerStats();
  const topUsers = await getTopUsers(5);

  let doc = await loadDocument('system_configs', 'bot_memory');
  if (doc && doc.data) doc = doc.data;
  const botMemories = doc?.memories || [];

  let context = `\n\n【系統上下文信息】\n\n`;

  if (botMemories.length > 0) {
    context += `【公共記憶 (優先)】\n`;
    botMemories.forEach((mem, i) => {
      context += `- ${mem}\n`;
    });
    context += `\n`;
  }

  context += `【用戶信息】\n`;
  context += `- ID: ${userInfo?.userId}\n`;
  context += `- 身份: ${userInfo?.profile?.identity || '未設定'}\n`;
  context += `- 親密度: ${userInfo?.profile?.intimacy || 0}/100\n`;
  context += `- 對話次數: ${userInfo?.conversationCount}\n`;
  context += `- 首次見面: ${userInfo?.firstSeen || '未知'}\n`;

  context += `\n【伺服器概況】\n`;
  context += `- 總用戶數: ${serverStats?.totalUsers}\n`;
  context += `- 記憶總數: ${serverStats?.totalMemories}\n`;

  context += `\n【活躍使用者排行】\n`;
  topUsers.forEach((u, i) => {
    context += `${i + 1}. ${u.identity} (${u.messageCount} 次對話)\n`;
  });

  if (additionalInfo.recentMessages) {
    context += `\n【最近對話】\n`;
    additionalInfo.recentMessages.forEach(msg => {
      context += `- ${msg.timestamp}: ${msg.message.slice(0, 100)}\n`;
    });
  }

  return context;
}

// ========================
// 🎯 增強的 Cohere 聊天函數 (已在 bot.js 輪替邏輯中，這裡僅作保留/參考)
// ========================

module.exports = {
  getFileList,
  getUserInfo,
  searchUsersByIdentity,
  getTopUsers,
  getServerStats,
  searchInUserMemory,
  getConversationContext,
  buildCohereContext
};
