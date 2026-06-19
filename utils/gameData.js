const fs = require('fs-extra');
const path = require('path');
const { loadDocument, saveDocument } = require('./mongodb.js');

// ============================
// 📊 遊戲數據管理工具 (MongoDB 版)
// ============================

async function getOrCreateUserData(userId) {
  try {
    const data = await loadDocument('user_data', userId);
    if (data) return data;
    
    const newData = {
      userId,
      coins: 1000,
      items: [],
      birthday: null,
      reminders: [],
      dataStats: {},
      roles: []
    };
    await saveDocument('user_data', userId, newData);
    return newData;
  } catch (e) {
    console.error(`getOrCreateUserData failed for ${userId}:`, e);
    return null;
  }
}

async function saveUserData(userId, data) {
  const toSave = { ...data };
  delete toSave._id;
  await saveDocument('user_data', userId, toSave);
}

async function addCoins(userId, amount) {
  const data = await getOrCreateUserData(userId);
  if (!data) return 0;
  data.coins = Math.max(0, (data.coins || 0) + amount);
  await saveUserData(userId, data);
  return data.coins;
}

async function getCoins(userId) {
  const data = await getOrCreateUserData(userId);
  return data?.coins || 0;
}

async function buyItem(userId, itemName, cost, itemData = {}) {
  const data = await getOrCreateUserData(userId);
  if (!data || (data.coins || 0) < cost) return false;
  
  data.coins -= cost;
  if (!data.items) data.items = [];
  data.items.push({
    name: itemName,
    bought: new Date().toISOString(),
    ...itemData
  });
  await saveUserData(userId, data);
  return true;
}

async function getItems(userId) {
  const data = await getOrCreateUserData(userId);
  return data?.items || [];
}

async function addReminder(userId, name, date, message) {
  const data = await getOrCreateUserData(userId);
  if (!data) return null;
  if (!data.reminders) data.reminders = [];
  const newReminder = {
    id: Date.now(),
    name,
    date,
    message,
    created: new Date().toISOString()
  };
  data.reminders.push(newReminder);
  await saveUserData(userId, data);
  return newReminder;
}

async function getReminders(userId) {
  const data = await getOrCreateUserData(userId);
  return data?.reminders || [];
}

async function deleteReminder(userId, reminderId) {
  const data = await getOrCreateUserData(userId);
  if (!data || !data.reminders) return;
  data.reminders = data.reminders.filter(r => r.id !== reminderId);
  await saveUserData(userId, data);
}

async function setBirthday(userId, date) {
  const data = await getOrCreateUserData(userId);
  if (!data) return;
  data.birthday = date;
  await saveUserData(userId, data);
}

async function getBirthday(userId) {
  const data = await getOrCreateUserData(userId);
  return data?.birthday || null;
}

async function getTopUsers(limit = 10) {
  const { getCollection } = require('./mongodb');
  try {
    const col = await getCollection('user_data');
    const users = await col.find({}).sort({ coins: -1 }).limit(limit).toArray();
    return users.map(u => ({
      userId: u.userId || u._id,
      coins: u.coins || 0,
      itemCount: u.items?.length || 0
    }));
  } catch (e) {
    console.error('getTopUsers failed:', e);
    return [];
  }
}

async function updateDataStats(userId, key, value) {
  const data = await getOrCreateUserData(userId);
  if (!data) return;
  if (!data.dataStats) data.dataStats = {};
  data.dataStats[key] = value;
  await saveUserData(userId, data);
}

async function getDataStats(userId) {
  const data = await getOrCreateUserData(userId);
  return data?.dataStats || {};
}

async function addRole(userId, roleName) {
  const data = await getOrCreateUserData(userId);
  if (!data) return;
  if (!data.roles) data.roles = [];
  if (!data.roles.includes(roleName)) {
    data.roles.push(roleName);
    await saveUserData(userId, data);
  }
}

async function getRoles(userId) {
  const data = await getOrCreateUserData(userId);
  return data?.roles || [];
}

async function removeRole(userId, roleName) {
  const data = await getOrCreateUserData(userId);
  if (!data || !data.roles) return;
  data.roles = data.roles.filter(r => r !== roleName);
  await saveUserData(userId, data);
}

async function getAllUsersWithBirthday(dateStr) {
  const { getCollection } = require('./mongodb');
  try {
    const col = await getCollection('user_data');
    return await col.find({ birthday: dateStr }).toArray();
  } catch (e) {
    console.error('getAllUsersWithBirthday failed:', e);
    return [];
  }
}

module.exports = {
  getOrCreateUserData,
  saveUserData,
  addCoins,
  getCoins,
  buyItem,
  getItems,
  addReminder,
  getReminders,
  deleteReminder,
  setBirthday,
  getBirthday,
  getTopUsers,
  updateDataStats,
  getDataStats,
  addRole,
  getRoles,
  removeRole,
  getAllUsersWithBirthday
};
