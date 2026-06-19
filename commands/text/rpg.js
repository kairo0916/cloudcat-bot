const { EmbedBuilder } = require('discord.js');
const rpg = require('../../utils/rpgSystem.js');
const path = require('path');
const { sendError } = require('../../utils/errorHandler.js');

module.exports = {
    name: 'rpg',
    async execute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        const uid = message.author.id;
        let p = await rpg.getPlayer(uid); // 每次操作前重新獲取玩家數據

        switch (sub) {
            case 'create': {
                const jobName = args[1];
                if (p) return sendError(message, '你已經有角色了！請使用 `$rpg status` 查看。', 'RPG 系統');
                if (!jobName || !rpg.PROFESSIONS[jobName]) {
                    const list = Object.keys(rpg.PROFESSIONS).map(j => `\`${j}\``).join('、');
                    const embed = new EmbedBuilder()
                        .setTitle('選擇你的職業')
                        .setDescription(`請使用 \`$rpg create <職業名稱>\` 來創建角色。\n\n**可選職業：**\n${list}`)
                        .setColor(0x3498DB)
                        .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                    return message.reply({ embeds: [embed] });
                }
                p = await rpg.createPlayer(uid, jobName);
                const embed = new EmbedBuilder()
                    .setTitle('⚔️ 冒險契約簽訂')
                    .setDescription(`歡迎，**${jobName}**！你的冒險旅程正式開始。`)
                    .addFields(
                        { name: '初始生命值', value: `${p.hp}`, inline: true },
                        { name: '初始攻擊力', value: `${p.atk}`, inline: true },
                        { name: '初始體力值', value: `${p.stamina}`, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            case 'help': {
                const embed = new EmbedBuilder()
                    .setTitle('📜 RPG 指令幫助手冊')
                    .setDescription('以下是通用的 RPG 指令。每個職業還有其專屬指令，請輸入職業名稱查看。')
                    .addFields(
                        { name: '基礎指令', value: '`$rpg create <職業>` - 創建角色\n`$rpg status` - 查看個人數值\n`$rpg help` - 顯示此幫助', inline: false },
                        { name: '經濟與成長', value: '`$rpg shop` - 瀏覽商店\n`$rpg buy <ID>` - 購買物品\n`$rpg sell <物品名稱>` - 出售物品\n`$rpg give <@用戶> <物品/金幣> <數量>` - 交易物品或金錢\n`$rpg job <新職業>` - 轉職 (花費 1000 金幣)', inline: false },
                        { name: '恢復與強化', value: '`$rpg heal` - 治療 (花費 20 金幣)\n`$rpg forge` - 裝備強化 (提升攻擊力)', inline: false },
                        { name: '職業專屬指令', value: '請直接輸入你的職業動作，例如：\n`$hunt` - 戰士狩獵\n`$chop` - 伐木工砍樹\n`$mine` - 礦工挖礦\n`$meditate` - 法師/武僧冥想\n(不需要加 $rpg)', inline: false }
                    )
                    .setColor(0x00AE86)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
        }

        if (!p) return sendError(message, '你還沒有角色！請輸入 `$rpg create <職業>` 開始。', 'RPG 系統');

        switch (sub) {
            case 'status': {
                const inv = Object.entries(p.inventory || {}).map(([k, v]) => `📦 **${k}**: ${v}`).join('\n') || '背包是空的';
                const embed = new EmbedBuilder()
                    .setTitle(`勇者 ${message.author.username} 的狀態`)
                    .setColor(0x3498DB)
                    .addFields(
                        { name: '職業', value: p.job, inline: true },
                        { name: '等級', value: `${p.level}`, inline: true },
                        { name: '生命值', value: `${p.hp}/${p.maxHp}`, inline: true },
                        { name: '體力值', value: `${p.stamina}/${p.maxStamina}`, inline: true },
                        { name: '攻擊力', value: `${p.atk} (+${(p.forgeLevel || 0) * 3} 強化)`, inline: true },
                        { name: '金幣', value: `${p.gold}`, inline: true },
                        { name: '裝備', value: `⚔️ 武器: ${p.weapon}\n🛡️ 防具: ${p.armor || '無'}\n💍 飾品: ${p.ring || '無'}`, inline: false },
                        { name: '背包', value: inv, inline: false }
                    )
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            case 'job': {
                const newJob = args[1];
                if (!newJob) return sendError(message, '請指定要轉職的職業名稱。', 'RPG 轉職');
                if (!rpg.PROFESSIONS[newJob]) {
                    const list = Object.keys(rpg.PROFESSIONS).map(j => `\`${j}\``).join('、');
                    return sendError(message, `找不到職業 **${newJob}**。\n\n**可選職業：**\n${list}`, '轉職失敗');
                }
                if (p.job === newJob) return sendError(message, `你已經是 **${newJob}** 了！無法轉成相同的職業。`, '轉職失敗');
                const cost = 1000;
                if (p.gold < cost) return sendError(message, `金幣不足！轉職需要 ${cost} 金幣。`, '金幣不足');

                p.gold -= cost;
                await rpg.changeJob(uid, newJob);
                p = await rpg.getPlayer(uid); // 重新載入更新後的玩家數據

                const embed = new EmbedBuilder()
                    .setTitle('🎊 轉職成功！')
                    .setDescription(`你成功轉職為 **${newJob}**！`)
                    .addFields(
                        { name: '新生命值', value: `${p.hp}/${p.maxHp}`, inline: true },
                        { name: '新攻擊力', value: `${p.atk}`, inline: true },
                        { name: '新體力值', value: `${p.stamina}/${p.maxStamina}`, inline: true },
                        { name: '剩餘金幣', value: `${p.gold}`, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            case 'forge': {
                const cost = 100 + ((p.forgeLevel || 0) * 100);
                const confirm = await rpg.forgeWeapon(uid);
                if (confirm.error) return sendError(message, confirm.error, '鍛造失敗');
                
                const embed = new EmbedBuilder()
                    .setTitle('⚒️ 裝備強化成功')
                    .setDescription(`你花費了 ${confirm.cost} 金幣，將裝備強化至 **+${confirm.player.forgeLevel}**！\n攻擊力提升了 3 點，目前總攻擊力：**${confirm.player.atk}**。`)
                    .setColor(0xF39C12)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            case 'sell': {
                const itemName = args[1];
                if (!itemName) return sendError(message, '請指定要出售的物品名稱。', '販售失敗');
                
                const gold = rpg.sellItem(uid, itemName);
                if (!gold) return sendError(message, `你的背包裡沒有 **${itemName}**。`, '庫存不足');
                
                p = await rpg.getPlayer(uid); // 重新載入更新後的玩家數據
                const embed = new EmbedBuilder()
                    .setTitle('💰 物品出售')
                    .setDescription(`你賣掉了 **${itemName}**，獲得了 ${gold} 金幣！`)
                    .setColor(0x2ECC71)
                    .setFooter({ text: `當前金幣: ${p.gold} | ${process.env.FOOTER || '白雲喵喵'}`, iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            case 'give': {
                const targetId = args[1]?.replace(/[<@!>]/g, '');
                const itemName = args[2];
                const amount = parseInt(args[3], 10);

                if (!targetId || !itemName || isNaN(amount) || amount <= 0) {
                    return sendError(message, '格式錯誤！請使用 `$rpg give @標記用戶 <物品名稱或金幣> <數量>`', '交易失敗');
                }

                const res = await rpg.give(uid, targetId, itemName, amount);
                if (res.error) return sendError(message, res.error, '交易失敗');

                p = await rpg.getPlayer(uid); // 重新載入更新後的玩家數據
                const embed = new EmbedBuilder()
                    .setTitle('🤝 交易成功')
                    .setDescription(`<@${uid}> ${res.message}`)
                    .setColor(0x2ECC71)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ content: `<@${targetId}>`, embeds: [embed] });
            }
            case 'heal': {
                const cost = 20;
                if (p.gold < cost) return sendError(message, `金幣不足！治療需要 ${cost} 金幣。`, '金幣不足');
                
                p.gold -= cost;
                await rpg.heal(uid, cost, 50); // 恢復 50 HP 和 25 Stamina
                p = await rpg.getPlayer(uid); // 重新載入更新後的玩家數據

                const embed = new EmbedBuilder()
                    .setTitle('🧪 治療完成')
                    .setDescription(`你支付了 ${cost} 金幣進行治療，生命與體力部分恢復了！`)
                    .addFields(
                        { name: '當前生命值', value: `${p.hp}/${p.maxHp}`, inline: true },
                        { name: '當前體力值', value: `${p.stamina}/${p.maxStamina}`, inline: true },
                        { name: '剩餘金幣', value: `${p.gold}`, inline: true }
                    )
                    .setColor(0x9B59B6)
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
            case 'shop': {
                const action = args[1]?.toLowerCase();
                const embed = new EmbedBuilder().setColor(0xE67E22);
                
                if (action === 'buy') {
                    const itemId = parseInt(args[2]);
                    if (isNaN(itemId)) return sendError(message, '請指定要購買的物品 ID。', '購買失敗');

                    let res = rpg.buyItem(uid, itemId, 'weapon');
                    if (res.error) {
                        res = rpg.buyItem(uid, itemId, 'consumable');
                    }

                    if (res.error) return sendError(message, res.error, '購買失敗');
                    
                    p = await rpg.getPlayer(uid); // 重新載入更新後的玩家數據
                    if (res.item.atk) { // 武器
                        embed.setTitle('⚔️ 裝備更新')
                            .setDescription(`恭喜！你花費了金幣購買了 **${res.item.name}**。\n攻擊力提升了 **${res.item.atk}** 點！`)
                            .setFooter({ text: `剩餘金幣: ${p.gold} | ${process.env.FOOTER || '白雲喵喵'}`, iconURL: client.user?.displayAvatarURL() });
                    } else { // 消耗品
                        embed.setTitle('🛍️ 購買成功')
                            .setDescription(`你花費了金幣購買了 **${res.item.name}** x1！`)
                            .setFooter({ text: `剩餘金幣: ${p.gold} | ${process.env.FOOTER || '白雲喵喵'}`, iconURL: client.user?.displayAvatarURL() });
                    }
                    return message.reply({ embeds: [embed] });
                }

                // 顯示商店清單
                embed.setTitle('🏪 冒險者商店')
                    .setDescription('使用 `$rpg buy <ID>` 來購買物品！')
                    .addFields(
                        { name: '⚔️ 武器', value: rpg.weapons.map(w => `\`[${w.id}]\` **${w.name}** (💰${w.price} | ⚔️+${w.atk})`).join('\n') || '無', inline: false },
                        { name: '🧪 消耗品', value: rpg.CONSUMABLES.map(c => `\`[${c.id}]\` **${c.name}** (💰${c.price} | 效果: ${c.type === 'hp' ? '恢復HP' : '恢復體力'} ${c.amount})`).join('\n') || '無', inline: false }
                    )
                    .setFooter({ text: process.env.FOOTER || '白雲喵喵', iconURL: client.user?.displayAvatarURL() });
                return message.reply({ embeds: [embed] });
            }
        }

        return sendError(message, '未知指令。輸入 `$rpg help` 查看可用清單。', 'RPG 系統');
    }
};