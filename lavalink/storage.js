const fs = require('fs-extra');
const path = require('path');
const { MongoClient } = require('mongodb');
const musicConfig = require('../config/music');

const COLLECTIONS = {
  guilds: 'music_guilds',
  users: 'music_users',
  tracks: 'music_tracks',
};

let mongoClient = null;
let mongoDb = null;
let mongoConnectPromise = null;
let initialized = false;

const jsonCache = new Map();
const writeQueues = new Map();

async function ensureDataDir() {
  await fs.ensureDir(musicConfig.dataDir);
}

async function connectMongo() {
  if (mongoDb) return mongoDb;
  if (mongoConnectPromise) return mongoConnectPromise;
  if (!musicConfig.mongodbEnable) return null;

  if (!musicConfig.mongoUrl) {
    throw new Error('MONGODB_URL is required when MONGODB_ENABLE=true');
  }

  mongoConnectPromise = (async () => {
    mongoClient = new MongoClient(musicConfig.mongoUrl);
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    return mongoDb;
  })();

  return mongoConnectPromise;
}

async function init() {
  if (initialized) return;
  initialized = true;
  await ensureDataDir();
  if (musicConfig.mongodbEnable) {
    await connectMongo();
  }
}

async function getJsonPath(collectionName) {
  await ensureDataDir();
  return path.join(musicConfig.dataDir, `${collectionName}.json`);
}

async function readJson(collectionName) {
  if (jsonCache.has(collectionName)) return jsonCache.get(collectionName);

  const filePath = await getJsonPath(collectionName);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
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

  const previous = writeQueues.get(collectionName);
  const next = previous.then(async () => {
    const filePath = await getJsonPath(collectionName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }).catch(err => {
    console.error(`[music-storage] Failed to write ${collectionName}:`, err);
  });

  writeQueues.set(collectionName, next);
  return next;
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
    for (const key of Object.keys(data)) {
      const doc = data[key];
      let matched = true;
      for (const [field, expected] of Object.entries(query)) {
        if (doc[field] !== expected) {
          matched = false;
          break;
        }
      }
      if (matched) return { _id: key, ...doc };
    }
    return null;
  }

  async updateOne(query, update, options = {}) {
    const data = await readJson(this.name);
    let targetId = query._id;

    if (!targetId) {
      for (const key of Object.keys(data)) {
        const doc = data[key];
        let matched = true;
        for (const [field, expected] of Object.entries(query)) {
          if (doc[field] !== expected) {
            matched = false;
            break;
          }
        }
        if (matched) {
          targetId = key;
          break;
        }
      }
    }

    if (!targetId && options.upsert) {
      targetId = query._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    if (!targetId) return;

    const current = data[targetId] || {};
    if (update.$set) {
      data[targetId] = { ...current, ...update.$set };
    } else {
      data[targetId] = { ...current, ...update };
    }
    await writeJson(this.name, data);
  }

  async deleteOne(query) {
    const data = await readJson(this.name);
    if (query._id && data[query._id]) {
      delete data[query._id];
      await writeJson(this.name, data);
      return;
    }

    for (const key of Object.keys(data)) {
      const doc = data[key];
      let matched = true;
      for (const [field, expected] of Object.entries(query)) {
        if (doc[field] !== expected) {
          matched = false;
          break;
        }
      }
      if (matched) {
        delete data[key];
        await writeJson(this.name, data);
        return;
      }
    }
  }

  find(query = {}) {
    return {
      sortParams: null,
      limitParams: null,
      async toArray() {
        const data = await readJson(this.name);
        let results = [];
        for (const key of Object.keys(data)) {
          const doc = data[key];
          let matched = true;
          for (const [field, expected] of Object.entries(query)) {
            if (doc[field] !== expected) {
              matched = false;
              break;
            }
          }
          if (matched) results.push({ _id: key, ...doc });
        }

        if (this.sortParams) {
          const [field, direction] = Object.entries(this.sortParams)[0];
          const dir = direction === -1 ? -1 : 1;
          results.sort((a, b) => {
            if (a[field] < b[field]) return -1 * dir;
            if (a[field] > b[field]) return 1 * dir;
            return 0;
          });
        }

        if (this.limitParams) {
          results = results.slice(0, this.limitParams);
        }

        return results;
      },
      sort(params) {
        this.sortParams = params;
        return this;
      },
      limit(num) {
        this.limitParams = num;
        return this;
      },
    };
  }

  async countDocuments(query = {}) {
    const data = await readJson(this.name);
    let count = 0;
    for (const key of Object.keys(data)) {
      const doc = data[key];
      let matched = true;
      for (const [field, expected] of Object.entries(query)) {
        if (doc[field] !== expected) {
          matched = false;
          break;
        }
      }
      if (matched) count++;
    }
    return count;
  }
}

async function getCollection(name) {
  await init();
  if (musicConfig.mongodbEnable) {
    const db = await connectMongo();
    return db.collection(name);
  }
  return new JsonCollection(name);
}

async function loadDocument(collectionName, id) {
  const col = await getCollection(collectionName);
  return col.findOne({ _id: id });
}

async function saveDocument(collectionName, id, data) {
  const col = await getCollection(collectionName);
  const payload = { ...data };
  delete payload._id;
  await col.updateOne({ _id: id }, { $set: payload }, { upsert: true });
}

async function deleteDocument(collectionName, id) {
  const col = await getCollection(collectionName);
  if (typeof col.deleteOne === 'function') {
    await col.deleteOne({ _id: id });
    return;
  }
  const doc = await loadDocument(collectionName, id);
  if (!doc) return;
  await col.updateOne({ _id: id }, { $set: null }, { upsert: false });
}

async function loadAll(collectionName, query = {}) {
  const col = await getCollection(collectionName);
  return col.find(query).toArray();
}

async function getCount(collectionName, query = {}) {
  const col = await getCollection(collectionName);
  return col.countDocuments(query);
}

module.exports = {
  COLLECTIONS,
  init,
  getCollection,
  loadDocument,
  saveDocument,
  deleteDocument,
  loadAll,
  getCount,
  isMongoEnabled: () => musicConfig.mongodbEnable,
};
