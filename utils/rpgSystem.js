const fs = require('fs-extra');
const path = require('path');
const { loadDocument, saveDocument } = require('./mongodb.js');

async function loadPlayerData() {
    const doc = await loadDocument('rpg_data', 'rpg_players');
    return doc || {};
}

async function savePlayerData(data) {
    const toSave = { ...data };
    delete toSave._id;
    await saveDocument('rpg_data', 'rpg_players', toSave);
}

const monsters = [
    { name: '史萊姆', hp: 20, atk: 3, exp: 10, gold: 5 },
    { name: '哥布林', hp: 45, atk: 8, exp: 25, gold: 15 },
    { name: '野狼', hp: 35, atk: 12, exp: 20, gold: 12 },
    { name: '精英騎士', hp: 120, atk: 25, exp: 100, gold: 50 },
    { name: '小龍', hp: 250, atk: 45, exp: 300, gold: 150 }
];

const weapons = [
    { id: 1, name: '木棒', atk: 5, price: 100 },
    { id: 2, name: '鐵劍', atk: 15, price: 500 },
    { id: 3, name: '屠龍大刀', atk: 50, price: 2000 },
    { id: 4, name: '聖劍 Excalibur', atk: 150, price: 8000 }
];

const CONSUMABLES = [
    { id: 101, name: '小型生命藥水', type: 'hp', amount: 50, price: 50 },
    { id: 102, name: '小型體力藥水', type: 'stamina', amount: 50, price: 40 },
    { id: 103, name: '烤肉串', type: 'stamina', amount: 30, price: 25 }
];

const MATERIALS = [
    { name: '木材', price: 20 },
    { name: '礦石', price: 30 },
    { name: '小麥', price: 15 },
    { name: '聖水', price: 50 },
    { name: '獸皮', price: 40 },
    { name: '藥草', price: 25 },
    { name: '藥水', price: 60 },
    { name: '鐵錠', price: 45 },
    { name: '便當', price: 35 },
    { name: '小費', price: 10 },
    { name: '聖光精華', price: 70 },
    { name: '靈魂碎屑', price: 80 }
];

const PROFESSIONS = {
    '戰士': { hp: 150, atk: 15, primaryAction: 'hunt', staminaCost: 20, desc: '高生命力的近戰職業，擅長狩獵。' },
    '法師': { hp: 80, atk: 25, primaryAction: 'meditate', staminaCost: 10, desc: '高攻擊力的魔法大師，透過冥想恢復。' },
    '盜賊': { hp: 100, atk: 12, primaryAction: 'steal', staminaCost: 15, desc: '擅長獲取額外金錢，透過偷竊致富。' },
    '聖騎士': { hp: 200, atk: 10, primaryAction: 'pray', staminaCost: 10, desc: '極高的防禦力，透過祈禱獲得聖水。' },
    '獵人': { hp: 110, atk: 18, primaryAction: 'track', staminaCost: 15, desc: '擅長野外追蹤，可獲得獸皮。' },
    '德魯伊': { hp: 130, atk: 14, primaryAction: 'forage', staminaCost: 10, desc: '與自然和諧相處，可採集藥草。' },
    '暗殺者': { hp: 90, atk: 30, primaryAction: 'ambush', staminaCost: 25, desc: '極致的爆發傷害，擅長伏擊。' },
    '煉金術師': { hp: 100, atk: 10, primaryAction: 'brew', staminaCost: 20, desc: '擅長製作各種藥劑，可調配藥水。' },
    '伐木工': { hp: 120, atk: 12, primaryAction: 'chop', staminaCost: 15, desc: '專精木材採集，可獲得木材。' },
    '農夫': { hp: 110, atk: 8, primaryAction: 'plant', staminaCost: 15, desc: '生產糧食的能手，可種植小麥。' },
    '礦工': { hp: 140, atk: 10, primaryAction: 'mine', staminaCost: 15, desc: '挖掘深山的寶藏，可獲得礦石。' },
    '鐵匠': { hp: 130, atk: 14, primaryAction: 'forge', staminaCost: 20, desc: '打造神兵的專家，可鍛造鐵錠。' },
    '廚師': { hp: 100, atk: 8, primaryAction: 'cook', staminaCost: 15, desc: '製作美味的食物，可烹飪便當。' },
    '吟遊詩人': { hp: 100, atk: 10, primaryAction: 'perform', staminaCost: 10, desc: '傳唱英雄的故事，可獲得小費。' },
    '牧師': { hp: 110, atk: 12, primaryAction: 'bless', staminaCost: 10, desc: '神聖的治癒者，可獲得聖光精華。' },
    '死靈法師': { hp: 90, atk: 28, primaryAction: 'summon', staminaCost: 25, desc: '操縱亡靈的力量，可召喚靈魂碎屑。' },
    '弓箭手': { hp: 100, atk: 20, primaryAction: 'target', staminaCost: 15, desc: '百步穿楊的射手，擅長精準射擊。' },
    '騎士': { hp: 160, atk: 14, primaryAction: 'patrol', staminaCost: 15, desc: '守護領土的誓言，可進行巡邏。' },
    '武僧': { hp: 140, atk: 16, primaryAction: 'meditate', staminaCost: 10, desc: '拳腳並用的宗師，透過修煉恢復。' },
    '商人': { hp: 100, atk: 8, primaryAction: 'trade', staminaCost: 10, desc: '掌握市場經濟，擅長交易。' }
};

const ALL_ITEMS = {};
MATERIALS.forEach(item => ALL_ITEMS[item.name] = item.price);
CONSUMABLES.forEach(item => ALL_ITEMS[item.name] = item.price);

module.exports = {
    weapons,
    PROFESSIONS,
    CONSUMABLES,
    MATERIALS,
    ALL_ITEMS,
    async getPlayer(userId) {
        const data = await loadPlayerData();
        const p = data[userId];
        if (!p) return null;
        if (p.stamina === undefined) p.stamina = 100;
        if (p.maxStamina === undefined) p.maxStamina = 100;
        if (!p.inventory) p.inventory = {};
        if (!p.job) p.job = '戰士';
        if (!p.weapon) p.weapon = '新手冒險者';
        if (!p.armor) p.armor = '平民布衣';
        if (!p.ring) p.ring = '無';
        if (p.forgeLevel === undefined) p.forgeLevel = 0;
        return p;
    },
    async createPlayer(userId, jobName) {
        const data = await loadPlayerData();
        const job = PROFESSIONS[jobName] || PROFESSIONS['戰士'];
        data[userId] = {
            job: jobName,
            level: 1,
            hp: job.hp,
            maxHp: job.hp,
            stamina: 100,
            maxStamina: 100,
            atk: job.atk,
            exp: 0,
            nextLevel: 100,
            gold: 0,
            weapon: '新手冒險者',
            armor: '平民布衣',
            ring: '無',
            forgeLevel: 0,
            inventory: {},
            lastWork: 0
        };
        await savePlayerData(data);
        return data[userId];
    },
    async changeJob(userId, newJobName) {
        const data = await loadPlayerData();
        const p = data[userId];
        const job = PROFESSIONS[newJobName];
        if (!p || !job) return false;
        
        p.job = newJobName;
        p.maxHp = job.hp + (p.level * 10);
        p.atk = job.atk + (p.level * 2);
        p.hp = p.maxHp;
        p.stamina = p.maxStamina;
        await savePlayerData(data);
        return true;
    },
    async hunt(userId) {
        const data = await loadPlayerData();
        const p = data[userId];
        if (!p) return { error: '請先使用 `$rpg create` 創建角色！' };
        if (p.stamina < 20) return { error: '體力不足 (需 20 點)！請休息或使用 `$rpg heal`。' };
        if (p.hp <= 0) return { error: '體力不足，請先休息或治療！' };

        p.stamina -= 20;
        const eventRand = Math.random();
        if (eventRand < 0.35) {
            const typeRand = Math.random();
            if (typeRand < 0.4) {
                const trapDmg = 10 + Math.floor(Math.random() * 15);
                p.hp = Math.max(0, p.hp - trapDmg);
                await savePlayerData(data);
                return { event: true, type: 'TRAP', message: `🕸️ 你不小心踩到了古代陷阱，失去了 ${trapDmg} 點生命值！`, player: p };
            } else if (typeRand < 0.7) {
                const foundGold = 20 + Math.floor(Math.random() * 40);
                p.gold += foundGold;
                await savePlayerData(data);
                return { event: true, type: 'TREASURE', message: `💰 你在草叢中發現了一個被遺忘的錢包，獲得了 ${foundGold} 枚金幣！`, player: p };
            } else {
                if (p.gold >= 50) {
                    p.gold -= 50;
                    p.atk += 3;
                    await savePlayerData(data);
                    return { event: true, type: 'MERCHANT', message: `🧪 你遇到了一位流浪商人。你支付了 50 金幣購買神秘藥水，攻擊力永久提升了 3 點！`, player: p };
                } else {
                    return { event: true, type: 'MERCHANT', message: `👤 你遇到了一位商人，但他看你口袋空空，嘲笑了你一聲就離開了。`, player: p };
                }
            }
        }

        const m = monsters[Math.floor(Math.random() * monsters.length)];
        let p_hp = p.hp;
        let m_hp = m.hp;

        while (p_hp > 0 && m_hp > 0) {
            m_hp -= p.atk;
            if (m_hp > 0) p_hp -= m.atk;
        }

        p.hp = Math.max(0, p_hp);
        p.stamina -= PROFESSIONS[p.job].staminaCost;
        if (p_hp > 0) {
            p.exp += m.exp;
            p.gold += m.gold;
            let levelUp = false;
            if (p.exp >= p.nextLevel) {
                p.level++;
                p.exp -= p.nextLevel;
                p.nextLevel = Math.floor(p.nextLevel * 1.5);
                p.maxHp += 20;
                p.hp = p.maxHp;
                p.atk += 5;
                levelUp = true;
            }
            await savePlayerData(data);
            return { win: true, monster: m, damage: m.hp, taken: p.hp - p_hp, levelUp, player: p };
        } else {
            await savePlayerData(data);
            return { win: false, monster: m, player: p };
        }
    },
    async heal(userId, cost, amount) {
        const data = await loadPlayerData();
        if (data[userId]) {
            const p = data[userId];
            p.hp = Math.min(p.maxHp, p.hp + amount);
            p.stamina = Math.min(p.maxStamina, p.stamina + amount / 2);
            await savePlayerData(data);
        }
    },
    async buyWeapon(userId, weaponId) {
        const data = await loadPlayerData();
        const p = data[userId];
        const w = weapons.find(item => item.id === weaponId);
        
        if (!p) return { error: '請先創建角色！' };
        if (!w) return { error: '找不到該武器！' };
        if (p.gold < w.price) return { error: `金幣不足！你需要 ${w.price} 金幣。` };

        p.gold -= w.price;
        p.atk += w.atk;
        p.weapon = w.name;
        await savePlayerData(data);
        return { success: true, weapon: w, player: p };
    },
    async give(fromUserId, toUserId, itemName, amount) {
        const data = await loadPlayerData();
        const p1 = data[fromUserId];
        const p2 = data[toUserId];

        if (!p1) return { error: '你還沒有創建角色！' };
        if (!p2) return { error: '對方還沒有創建角色！' };
        if (fromUserId === toUserId) return { error: '你不能給自己東西！' };
        if (amount <= 0 || !Number.isInteger(amount)) return { error: '請輸入有效的數量！' };

        if (itemName === '金幣' || itemName === 'gold') {
            if (p1.gold < amount) return { error: `你的金幣不足！(目前: ${p1.gold})` };
            p1.gold -= amount;
            p2.gold += amount;
            await savePlayerData(data);
            return { success: true, message: `成功給予對方 ${amount} 金幣！` };
        } else {
            if (!p1.inventory || !p1.inventory[itemName] || p1.inventory[itemName] < amount) {
                return { error: `你的 ${itemName} 數量不足！` };
            }
            p1.inventory[itemName] -= amount;
            if (p1.inventory[itemName] === 0) delete p1.inventory[itemName];
            
            if (!p2.inventory) p2.inventory = {};
            p2.inventory[itemName] = (p2.inventory[itemName] || 0) + amount;
            
            await savePlayerData(data);
            return { success: true, message: `成功給予對方 ${amount} 個 ${itemName}！` };
        }
    },
    async forgeWeapon(userId) {
        const data = await loadPlayerData();
        const p = data[userId];
        if (!p) return { error: '請先創建角色！' };
        
        const cost = 100 + ((p.forgeLevel || 0) * 100);
        if (p.gold < cost) return { error: `金幣不足！強化需要 ${cost} 金幣。` };
        
        p.gold -= cost;
        p.forgeLevel = (p.forgeLevel || 0) + 1;
        p.atk += 3;
        await savePlayerData(data);
        return { success: true, player: p, cost };
    },
    async work(userId) {
        const data = await loadPlayerData();
        const p = data[userId];
        if (!p) return { error: '請先創建角色！' };
        const job = PROFESSIONS[p.job];
        if (!job) return { error: '找不到職業資料！' };

        if (p.stamina < job.staminaCost) return { error: `體力不足 (需 ${job.staminaCost} 點)！` };
        
        const now = Date.now();
        if (now - (p.lastWork || 0) < 30000) { // 30秒冷卻
            const remaining = Math.ceil((30000 - (now - (p.lastWork || 0))) / 1000);
            return { error: `工作太累了，請休息 ${remaining} 秒再繼續。` };
        }

        p.stamina -= job.staminaCost;
        p.lastWork = now;
        
        let message = '';
        let gain = '';
        const rand = Math.random();
        
        // 根據職業決定產出
        const outputs = {
            '伐木工': '木材',
            '農夫': '小麥',
            '礦工': '礦石',
            '聖騎士': '聖水',
            '獵人': '獸皮',
            '德魯伊': '藥草',
            '煉金術師': '藥水',
            '鐵匠': '鐵錠',
            '廚師': '便當',
            '吟遊詩人': '小費',
            '牧師': '聖光精華',
            '死靈法師': '靈魂碎屑'
        };

        const item = outputs[p.job];
        if (item) {
            const amount = Math.floor(Math.random() * 3) + 1;
            p.inventory[item] = (p.inventory[item] || 0) + amount;
            message = `你使用了 **${job.primaryAction}**，獲得了 **${item}** x${amount}！`;
        } else if (p.job === '盜賊') {
            const gold = Math.floor(Math.random() * 50) + 20;
            p.gold += gold;
            message = `你使用了 **${job.primaryAction}**，從路人身上摸走了 **${gold}** 金幣！`;
        } else if (p.job === '商人') {
            const gold = Math.floor(Math.random() * 100) + 50;
            p.gold += gold;
            message = `你進行了 **${job.primaryAction}**，在市場低買高賣賺到了 **${gold}** 金幣！`;
        } else {
            p.stamina = Math.min(p.maxStamina, p.stamina + 30);
            message = `你進行了 **${job.primaryAction}**，精神煥發，恢復了 30 點體力！`;
        }

        await savePlayerData(data);
        return { success: true, message, player: p };
    },
    async buyItem(userId, itemId, type) {
        const data = await loadPlayerData();
        const p = data[userId];
        if (!p) return { error: '請先創建角色！' };

        let item;
        if (type === 'weapon') {
            item = weapons.find(w => w.id === itemId);
        } else {
            item = CONSUMABLES.find(c => c.id === itemId);
        }

        if (!item) return { error: '找不到該物品！' };
        if (p.gold < item.price) return { error: `金幣不足！需要 ${item.price} 金幣。` };

        p.gold -= item.price;
        if (type === 'weapon') {
            p.atk += item.atk;
            p.weapon = item.name;
        } else {
            p.inventory[item.name] = (p.inventory[item.name] || 0) + 1;
        }

        await savePlayerData(data);
        return { success: true, item, player: p };
    },
    async sellItem(userId, itemName) {
        const data = await loadPlayerData();
        const p = data[userId];
        if (!p) return null;

        if (!p.inventory[itemName] || p.inventory[itemName] <= 0) return null;

        const price = ALL_ITEMS[itemName] || 10;
        p.inventory[itemName] -= 1;
        if (p.inventory[itemName] === 0) delete p.inventory[itemName];
        p.gold += price;

        await savePlayerData(data);
        return price;
    }
};
