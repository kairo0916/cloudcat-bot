const { PermissionFlagsBits } = require('discord.js');
const musicConfig = require('../config/music');
const storage = require('./storage');

function createPlayerManager(ctx) {
  async function getGuildState(guildId) {
    // 修復：必須先 await 等待結果出來，再判斷是否為 null，預設物件才會生效
    const doc = await storage.loadDocument(storage.COLLECTIONS.guilds, guildId);
    return doc || {
      _id: guildId,
      guildId,
      queue: { current: null, previous: [], tracks: [], repeatMode: 'off' },
      state: {},
      settings: {
        volume: musicConfig.defaultVolume,
        shuffleEnabled: false,
      },
      stats: {
        playCount: 0,
        requestCount: 0,
      },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  async function saveGuildState(guildId, patch) {
    const current = await getGuildState(guildId);
    
    // 加強容錯：確保 current.queue, current.state 等物件存在，避免展開 null 報錯
    const next = {
      ...current,
      ...patch,
      queue: patch.queue ? { ...(current.queue || {}), ...patch.queue } : current.queue,
      state: patch.state ? { ...(current.state || {}), ...patch.state } : current.state,
      settings: patch.settings ? { ...(current.settings || {}), ...patch.settings } : current.settings,
      stats: patch.stats ? { ...(current.stats || {}), ...patch.stats } : current.stats,
      updatedAt: new Date().toISOString(),
    };
    await storage.saveDocument(storage.COLLECTIONS.guilds, guildId, next);
    return next;
  }

  function getPlayer(guildId) {
    return ctx.manager?.getPlayer(guildId);
  }

  async function ensurePlayer(interaction, voiceChannelId, textChannelId) {
    const guildId = interaction.guildId;
    let player = getPlayer(guildId);

    if (!player) {
      try {
        player = ctx.manager.createPlayer({
          guildId,
          voiceChannelId,
          textChannelId,
          selfDeaf: true,
          volume: musicConfig.defaultVolume,
        });
      } catch (err) {
        if (err.message.includes('No available Node')) {
          throw new Error('音樂伺服器 (Lavalink) 尚未連線或無可用節點，請稍後再試！');
        }
        throw err;
      }
    }

    if (!player.connected) {
      await player.connect();
    }

    await saveGuildState(guildId, {
      state: {
        voiceChannelId,
        textChannelId,
        panelChannelId: textChannelId,
      },
      settings: {
        volume: player.volume || musicConfig.defaultVolume,
      },
    });

    return player;
  }

  async function setVolume(player, volume) {
    if (!player) throw new Error('Player not found');
    const safeVolume = Math.max(1, Math.min(100, Number(volume)));
    await player.setVolume(safeVolume);
    await saveGuildState(player.guildId, {
      settings: {
        volume: safeVolume,
      },
    });
    return safeVolume;
  }

  async function pause(player) {
    if (!player) throw new Error('Player not found');
    await player.pause();
    return player;
  }

  async function resume(player) {
    if (!player) throw new Error('Player not found');
    await player.resume();
    return player;
  }

  async function stop(player) {
    if (!player) throw new Error('Player not found');
    await player.stopPlaying(true);
    return player;
  }

  async function destroy(player, reason = 'destroyed', options = {}) {
    if (!player) return;
    const guildId = player.guildId;
    if (options.clearQueue) {
      await ctx.queueManager.clearQueueAndHistory(player).catch(() => {});
    }
    await player.destroy(reason).catch(() => {});
    if (options.clearState !== false) {
      await saveGuildState(guildId, {
        state: {
          voiceChannelId: null,
          panelMessageId: null,
          panelChannelId: null,
          lastSoloAt: null,
        },
      });
    }
  }

  function hasAdmin(member) {
    return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
  }

  function sameVoiceChannel(member, player) {
    if (!member || !player) return false;
    const memberChannelId = member.voice?.channelId;
    return Boolean(memberChannelId && memberChannelId === player.voiceChannelId);
  }

  function canControl(member, player, requesterId) {
    if (!member) return false;
    if (hasAdmin(member)) return true;
    if (requesterId && member.id === requesterId) return true;
    return sameVoiceChannel(member, player);
  }

  async function touchVoiceState(guildId, patch) {
    return saveGuildState(guildId, {
      state: patch,
    });
  }

  async function touchPlaybackState(player, patch) {
    if (!player) return;
    return saveGuildState(player.guildId, patch);
  }

  async function getOrCreateState(guildId) {
    return getGuildState(guildId);
  }

  async function clearPanelRefs(guildId) {
    return saveGuildState(guildId, {
      state: {
        panelMessageId: null,
        panelChannelId: null,
      },
    });
  }

  async function updatePanelRefs(guildId, refs) {
    return saveGuildState(guildId, {
      state: refs,
    });
  }

  return {
    getPlayer,
    ensurePlayer,
    setVolume,
    pause,
    resume,
    stop,
    destroy,
    hasAdmin,
    sameVoiceChannel,
    canControl,
    touchVoiceState,
    touchPlaybackState,
    getOrCreateState,
    updatePanelRefs,
    clearPanelRefs,
    getGuildState,
    saveGuildState,
  };
}

module.exports = createPlayerManager;