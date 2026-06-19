const { connectToMongo, loadDocument, saveDocument } = require('./mongodb.js');

async function loadMemory(userId) {
  const doc = await loadDocument('ai_memories', userId);
  return doc?.messages || [];
}

async function saveMemory(userId, memory) {
  await saveDocument('ai_memories', userId, { messages: memory });
}

async function loadProfile(userId) {
  const doc = await loadDocument('user_profiles', userId);
  return doc || {};
}

async function saveProfile(userId, profile) {
  await saveDocument('user_profiles', userId, profile);
}

async function getSystemConfig(id) {
  return await loadDocument('system_configs', id);
}

async function saveSystemConfig(id, data) {
  await saveDocument('system_configs', id, data);
}

module.exports = {
  loadMemory,
  saveMemory,
  loadProfile,
  saveProfile,
  getSystemConfig,
  saveSystemConfig
};
