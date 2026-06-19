const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const USE_MONGO = process.env.DATABASE_ENABLE !== 'false';
const DATA_DIR = path.join(__dirname, '..', 'data');

let client;
let db;
let connectPromise = null;

// --- MONGODB LOGIC ---
async function connectToMongo() {
  if (db) return db;
  if (connectPromise) return connectPromise;

  const url = process.env.MONGODB_URL;
  if (!url) {
    console.error('❌ MONGODB_URL not found in .env');
    process.exit(1);
  }
  
  connectPromise = (async () => {
    try {
      client = new MongoClient(url);
      await client.connect();
      db = client.db('wcbot');
      console.log('✅ MongoDB 數據庫連線成功');
      return db;
    } catch (err) {
      console.error('❌ MongoDB 數據庫連線失敗:', err);
      process.exit(1);
    }
  })();
  
  return connectPromise;
}

// --- JSON LOGIC ---
let jsonInitMsgShown = false;
const jsonCache = new Map();
const writeQueues = new Map();

async function getJsonPath(collectionName) {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  return path.join(DATA_DIR, `${collectionName}.json`);
}

async function readJson(collectionName) {
  if (jsonCache.has(collectionName)) return jsonCache.get(collectionName);
  
  const filePath = await getJsonPath(collectionName);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(data);
    jsonCache.set(collectionName, parsed);
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(filePath, '{}', 'utf8');
      jsonCache.set(collectionName, {});
      return {};
    }
    throw err;
  }
}

async function writeJson(collectionName, data) {
  jsonCache.set(collectionName, data);
  
  if (!writeQueues.has(collectionName)) {
    writeQueues.set(collectionName, Promise.resolve());
  }

  const queue = writeQueues.get(collectionName);
  const nextWrite = queue.then(async () => {
    const filePath = await getJsonPath(collectionName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }).catch(err => {
    console.error(`[JSON 資料庫] 寫入 ${collectionName} 失敗:`, err);
  });

  writeQueues.set(collectionName, nextWrite);
  return nextWrite;
}

class JsonCollection {
  constructor(name) {
    this.name = name;
  }

  async findOne(query) {
    const data = await readJson(this.name);
    if (query._id) {
      const doc = data[query._id];
      return doc ? { _id: query._id, ...doc } : null;
    }
    // Simple filter
    for (const key in data) {
      let match = true;
      for (const qKey in query) {
        if (data[key][qKey] !== query[qKey]) match = false;
      }
      if (match) return { _id: key, ...data[key] };
    }
    return null;
  }

  async updateOne(query, update, options) {
    const data = await readJson(this.name);
    let targetId = query._id;
    
    if (!targetId) {
      for (const key in data) {
        let match = true;
        for (const qKey in query) {
          if (data[key][qKey] !== query[qKey]) match = false;
        }
        if (match) { targetId = key; break; }
      }
    }

    if (!targetId && options?.upsert) {
      targetId = query._id || Date.now().toString();
    }

    if (targetId) {
      if (!data[targetId]) data[targetId] = {};
      if (update.$set) {
        Object.assign(data[targetId], update.$set);
      } else {
        Object.assign(data[targetId], update);
      }
      await writeJson(this.name, data);
    }
  }

  find(query = {}) {
    return {
      sortParams: null,
      limitParams: null,
      name: this.name,
      sort(params) { this.sortParams = params; return this; },
      limit(num) { this.limitParams = num; return this; },
      async toArray() {
        const data = await readJson(this.name);
        let results = [];
        for (const key in data) {
          let match = true;
          for (const qKey in query) {
            if (data[key][qKey] !== query[qKey]) match = false;
          }
          if (match) results.push({ _id: key, ...data[key] });
        }
        
        if (this.sortParams) {
          const sortKey = Object.keys(this.sortParams)[0];
          const dir = this.sortParams[sortKey] === -1 ? -1 : 1;
          results.sort((a, b) => {
            if (a[sortKey] < b[sortKey]) return -1 * dir;
            if (a[sortKey] > b[sortKey]) return 1 * dir;
            return 0;
          });
        }
        
        if (this.limitParams) {
          results = results.slice(0, this.limitParams);
        }
        return results;
      }
    };
  }

  async countDocuments(query = {}) {
    const data = await readJson(this.name);
    let count = 0;
    for (const key in data) {
      let match = true;
      for (const qKey in query) {
        if (data[key][qKey] !== query[qKey]) match = false;
      }
      if (match) count++;
    }
    return count;
  }
}

// --- UNIFIED API ---
async function initDb() {
  if (USE_MONGO) return await connectToMongo();
  if (!jsonInitMsgShown) {
    console.log('📁 使用本地 JSON 數據庫作為備用 (DATABASE_ENABLE=false)');
    jsonInitMsgShown = true;
  }
}

async function getCollection(name) {
  if (USE_MONGO) {
    const database = await connectToMongo();
    return database.collection(name);
  } else {
    await readJson(name); // Ensure file exists
    return new JsonCollection(name);
  }
}

async function loadDocument(collectionName, id) {
  const col = await getCollection(collectionName);
  return await col.findOne({ _id: id });
}

async function saveDocument(collectionName, id, data) {
  const col = await getCollection(collectionName);
  const toSave = { ...data };
  delete toSave._id;
  await col.updateOne({ _id: id }, { $set: toSave }, { upsert: true });
}

async function loadAll(collectionName) {
  const col = await getCollection(collectionName);
  return await col.find({}).toArray();
}

async function getCount(collectionName) {
  const col = await getCollection(collectionName);
  return await col.countDocuments();
}

initDb();

module.exports = {
  connectToMongo: initDb,
  getCollection,
  loadDocument,
  saveDocument,
  loadAll,
  getCount,
  client: () => USE_MONGO ? client : null
};