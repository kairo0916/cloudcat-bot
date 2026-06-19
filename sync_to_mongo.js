const fs = require('fs-extra');
const path = require('path');
const { connectToMongo, getCollection } = require('./utils/mongodb');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'data/users');
const SYSTEM_DIR = path.join(__dirname, 'data/system');
const USER_DIR = path.join(__dirname, 'user');
const RPG_DIR = path.join(__dirname, 'user/rpg/data');

async function sync() {
  console.log('🚀 正在將資料同步至MongoDB...');
  await connectToMongo();

  // 1. Sync User AI Memories & Profiles (from data/users)
  if (fs.existsSync(DATA_DIR)) {
    const userFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const memCol = await getCollection('ai_memories');
    const profCol = await getCollection('user_profiles');

    for (const file of userFiles) {
      const filePath = path.join(DATA_DIR, file);
      let data;
      try { data = fs.readJsonSync(filePath); } catch(e) { continue; }
      const id = file.replace('.profile.json', '').replace('.json', '');

      if (file.includes('.profile.json')) {
        const updateData = (Array.isArray(data) || typeof data !== 'object') ? { data } : data;
        await profCol.updateOne({ _id: id }, { $set: updateData }, { upsert: true });
        console.log(`同步profile: ${id}`);
      } else {
        const messages = Array.isArray(data) ? data : [data];
        await memCol.updateOne({ _id: id }, { $set: { messages } }, { upsert: true });
        console.log(`同步記憶: ${id}`);
      }
    }
  }

  // 2. Sync System Configs (from data/system)
  if (fs.existsSync(SYSTEM_DIR)) {
    const systemFiles = fs.readdirSync(SYSTEM_DIR).filter(f => f.endsWith('.json'));
    const sysCol = await getCollection('system_configs');

    for (const file of systemFiles) {
      const filePath = path.join(SYSTEM_DIR, file);
      let data;
      try { data = fs.readJsonSync(filePath); } catch(e) { continue; }
      const id = file.replace('.json', '');
      
      const updateData = (Array.isArray(data) || typeof data !== 'object') ? { data } : data;
      
      await sysCol.updateOne({ _id: id }, { $set: updateData }, { upsert: true });
      console.log(`同步系統配置: ${id}`);
    }
    
    const usageFile = path.join(SYSTEM_DIR, 'used_command.txt');
    if (fs.existsSync(usageFile)) {
      const count = parseInt(fs.readFileSync(usageFile, 'utf8').trim()) || 0;
      await sysCol.updateOne({ _id: 'command_usage' }, { $set: { count } }, { upsert: true });
      console.log(`同步命令使用量: ${count}`);
    }
  }

  // 3. Sync User Data (from user/)
  if (fs.existsSync(USER_DIR)) {
    const userFiles = fs.readdirSync(USER_DIR).filter(f => f.endsWith('.json'));
    const userDataCol = await getCollection('user_data');

    for (const file of userFiles) {
      const filePath = path.join(USER_DIR, file);
      let data;
      try { data = fs.readJsonSync(filePath); } catch(e) { continue; }
      const id = file.replace('.json', '');
      
      const updateData = (Array.isArray(data) || typeof data !== 'object') ? { data } : data;
      
      await userDataCol.updateOne({ _id: id }, { $set: updateData }, { upsert: true });
      console.log(`同步使用者資料: ${id}`);
    }
  }

  // 4. Sync RPG Data (from user/rpg/data)
  if (fs.existsSync(RPG_DIR)) {
    const rpgFile = path.join(RPG_DIR, 'rpg_players.json');
    if (fs.existsSync(rpgFile)) {
      let data;
      try { data = fs.readJsonSync(rpgFile); } catch(e) { data = null; }
      if (data) {
        const rpgCol = await getCollection('rpg_data');
        const updateData = (Array.isArray(data) || typeof data !== 'object') ? { data } : data;
        await rpgCol.updateOne({ _id: 'rpg_players' }, { $set: updateData }, { upsert: true });
        console.log('同步RPG玩家資料');
      }
    }
  }

  console.log('✅ 同步完成！現在可以使用MongoDB儲存。');
  process.exit(0);
}

sync().catch(err => {
  console.error('❌ 同步失敗:', err);
  process.exit(1);
});
