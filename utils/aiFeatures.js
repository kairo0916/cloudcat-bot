const fs = require('fs-extra');
const path = require('path');
const { loadDocument, saveDocument } = require('./mongodb');

// ========================
// 🧠 主題記憶 & 用戶偏好
// ========================

function extractTopics(message) {
  const topicKeywords = ['關於', '怎麼', '什麼', '為什麼', '講講', '問問', '聊聊', '我想', '想知道'];
  let topics = [];
  const words = message.split(/[\s，。！？]/);
  words.forEach((word, i) => {
    if (topicKeywords.some(k => word.includes(k))) {
      if (i + 1 < words.length) topics.push(words[i + 1]);
    }
  });
  return topics;
}

async function updateUserProfile(userId, updates) {
  let profile = await getUserProfile(userId);

  const newProfile = {
    ...profile,
    ...updates,
    lastUpdated: new Date().toISOString()
  };

  try {
    const toSave = { ...newProfile };
    delete toSave._id;
    await saveDocument('user_profiles', userId, toSave);
  } catch (e) {
    console.warn(`無法保存用戶 profile ${userId}:`, e.message);
  }

  return newProfile;
}

async function getUserProfile(userId) {
  try {
    const doc = await loadDocument('user_profiles', userId);
    return doc || {};
  } catch (e) {
    console.warn(`無法讀取用戶 profile ${userId}:`, e.message);
  }
  return {};
}

// ========================
// 😊 心情分析
// ========================

function analyzeMood(message) {
  const moods = {
    happy: ['開心', '哈哈', '笑', '😆', '🤣', '太棒', '耶', '讚', '爽'],
    sad: ['難過', '難受', '哭', '😢', '😭', '傷心', '悲', '失望'],
    angry: ['生氣', '靠北', '爛', '討厭', '😤', '🤬', '煩', '氣死'],
    confused: ['什麼', '怎樣', '？？', '不懂', '莫名', '奇怪'],
    excited: ['天啊', '哇', '靠', '超', '必須', '🔥', '炸裂', '絕了']
  };

  let detected = {};
  for (const [mood, keywords] of Object.entries(moods)) {
    detected[mood] = keywords.filter(k => message.includes(k)).length;
  }

  const maxMood = Object.keys(detected).reduce((a, b) => detected[a] > detected[b] ? a : b);
  return detected[maxMood] > 0 ? maxMood : 'neutral';
}

// ========================
// ⭐ 對話品質評分
// ========================

function scoreConversation(userMessage, aiResponse) {
  let score = 50;

  // 長度加分
  if (userMessage.length > 10) score += 10;
  if (aiResponse.length > 50) score += 10;

  // 有趣度
  if (aiResponse.includes('😆') || aiResponse.includes('🤣') || aiResponse.includes('笑')) score += 15;
  if (aiResponse.includes('✨') || aiResponse.includes('🔥') || aiResponse.includes('💙')) score += 10;

  // 互動性
  if (aiResponse.includes('？') || aiResponse.includes('呢') || aiResponse.includes('吧')) score += 10;

  // 避免單調
  if (aiResponse.length < 20) score -= 20;

  return Math.min(100, Math.max(0, score));
}

// ========================
// 📝 對話摘要
// ========================

function summarizeConversation(memory) {
  if (memory.length < 6) return null;

  const recentMessages = memory.slice(-6);
  const summary = {
    messageCount: memory.length,
    topics: [],
    avgMood: 'neutral',
    timestamp: new Date().toISOString()
  };

  recentMessages.forEach(msg => {
    if (msg.role === 'USER') {
      const topics = extractTopics(msg.message);
      summary.topics.push(...topics);
    }
  });

  summary.topics = [...new Set(summary.topics.slice(0, 3))];
  return summary;
}

// ========================
// 🎟️ 親密度系統
// ========================

async function updateIntimacy(userId, amount = 1) {
  const profile = await getUserProfile(userId);
  const currentIntimacy = profile.intimacy || 0;
  const newIntimacy = Math.min(100, currentIntimacy + amount);
  return await updateUserProfile(userId, { intimacy: newIntimacy });
}

function getIntimacyLevel(intimacy = 0) {
  if (intimacy < 10) return '陌生人';
  if (intimacy < 25) return '新朋友';
  if (intimacy < 50) return '普通朋友';
  if (intimacy < 75) return '好朋友';
  return '最親密朋友';
}

// ========================
// 🎂 紀念日提醒
// ========================

async function setAnniversary(userId, name, date) {
  const profile = await getUserProfile(userId);
  const anniversaries = profile.anniversaries || {};
  anniversaries[name] = date;
  return await updateUserProfile(userId, { anniversaries });
}

async function checkAnniversaries(userId) {
  const profile = await getUserProfile(userId);
  const anniversaries = profile.anniversaries || {};
  const today = new Date().toISOString().split('T')[0];

  const todayAnniversaries = [];
  Object.entries(anniversaries).forEach(([name, date]) => {
    if (date.includes(today.slice(5))) {
      todayAnniversaries.push(name);
    }
  });

  return todayAnniversaries;
}

// ========================
// 🎭 身份設定
// ========================

async function setUserIdentity(userId, identity) {
  return await updateUserProfile(userId, { identity });
}

// ========================
// 📤 對話匯出
// ========================

async function exportConversation(userId, format = 'txt') {
  const doc = await loadDocument('ai_memories', userId);
  let memory = doc?.messages || [];

  if (format === 'txt') {
    let text = `【白雲與 ${userId} 的對話記錄】\n生成時間: ${new Date().toLocaleString('zh-TW')}\n\n`;
    memory.forEach(msg => {
      text += `[${msg.timestamp || '未知'}] ${msg.role}\n${msg.message}\n\n`;
    });
    return text;
  }

  return JSON.stringify(memory, null, 2);
}

// ========================
// 🖼️ 圖片分析增強
// ========================

function analyzeImageContent(imageUrl) {
  const contentTypes = {
    faces: '這張圖片中有人物呢～看起來很有故事。',
    nature: '大自然的圖片總是讓人心曠神怡～',
    objects: '這些物品的排列很有美感呢',
    text: '我看到圖片中有文字耶～',
    meme: '這是個梗圖！很有趣呢😆',
    artwork: '這是藝術作品嗎？很棒～✨',
    screenshot: '看起來像是螢幕截圖',
    food: '食物圖片？讓我流口水了～',
    animal: '動物！我喜歡看可愛的動物～🐱',
    architecture: '這個建築很壯觀呢'
  };

  const moods = [
    '這張圖片讓我感到溫暖',
    '這看起來很有趣',
    '我很喜歡這張圖的風格',
    '這個構圖很不錯',
    '色彩搭配得很好呢'
  ];

  return {
    primaryAnalysis: contentTypes[Object.keys(contentTypes)[Math.floor(Math.random() * Object.keys(contentTypes).length)]],
    mood: moods[Math.floor(Math.random() * moods.length)],
    confidence: Math.floor(Math.random() * 30 + 70) + '%'
  };
}

// ========================
// 👥 多人對話識別
// ========================

async function trackMultiUserChat(userId, channelId, messageCount) {
  const id = `.chat_${channelId}`;
  let chatData = await loadDocument('system_configs', id);
  
  if (!chatData) {
    chatData = { users: {}, lastUpdated: new Date().toISOString() };
  } else {
    // If it was wrapped as {data: ...} by sync script
    if (chatData.data) chatData = chatData.data;
  }

  if (!chatData.users[userId]) {
    chatData.users[userId] = { messageCount: 0, lastMessage: null };
  }

  chatData.users[userId].messageCount += messageCount;
  chatData.users[userId].lastMessage = new Date().toISOString();
  chatData.lastUpdated = new Date().toISOString();

  try {
    const toSave = { ...chatData };
    delete toSave._id;
    await saveDocument('system_configs', id, toSave);
  } catch (e) {
    console.warn(`無法保存群組聊天數據 ${channelId}:`, e.message);
  }

  return chatData;
}

module.exports = {
  extractTopics,
  updateUserProfile,
  getUserProfile,
  analyzeMood,
  scoreConversation,
  summarizeConversation,
  updateIntimacy,
  getIntimacyLevel,
  setAnniversary,
  checkAnniversaries,
  setUserIdentity,
  exportConversation,
  analyzeImageContent,
  trackMultiUserChat
};
