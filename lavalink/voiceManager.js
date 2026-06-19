const { EmbedBuilder } = require('discord.js');
const musicConfig = require('../config/music');

function createVoiceManager(ctx) {
  const leaveTimers = new Map();

  function clearLeaveTimer(guildId) {
    const timer = leaveTimers.get(guildId);
    if (timer) clearTimeout(timer);
    leaveTimers.delete(guildId);
  }

  function scheduleLeaveTimer(guildId) {
    if (leaveTimers.has(guildId)) return;
    const timer = setTimeout(async () => {
      leaveTimers.delete(guildId);
      const player = ctx.playerManager.getPlayer(guildId);
      if (!player) return;
      const guild = ctx.client.guilds.cache.get(guildId);
      if (!guild) return;
      const voiceChannel = guild.channels.cache.get(player.voiceChannelId);
      if (!voiceChannel || !voiceChannel.members) return;

      const humans = voiceChannel.members.filter(member => !member.user.bot);
      if (humans.size > 0) return;

      const state = await ctx.playerManager.getGuildState(guildId);
      const textChannelId = state?.state?.textChannelId || state?.state?.panelChannelId;
      const textChannel = textChannelId ? guild.channels.cache.get(textChannelId) : null;

      await ctx.playerManager.destroy(player, 'empty-channel', { clearState: true, clearQueue: false }).catch(() => {});

      if (textChannel && textChannel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🚶 機器人離開了！')
          .setDescription('沒人在頻道內我就離開囉~')
          .setTimestamp();
        await textChannel.send({ embeds: [embed] }).catch(() => {});
      }

      await ctx.playerManager.clearPanelRefs(guildId).catch(() => {});
    }, musicConfig.emptyChannelTimeoutMs);

    leaveTimers.set(guildId, timer);
  }

  async function evaluateAutoLeave(guildId) {
    const player = ctx.playerManager.getPlayer(guildId);
    if (!player) {
      clearLeaveTimer(guildId);
      return;
    }

    const guild = ctx.client.guilds.cache.get(guildId);
    if (!guild) {
      clearLeaveTimer(guildId);
      return;
    }

    const voiceChannel = guild.channels.cache.get(player.voiceChannelId);
    if (!voiceChannel || !voiceChannel.members) {
      clearLeaveTimer(guildId);
      return;
    }

    const humans = voiceChannel.members.filter(member => !member.user.bot);
    if (humans.size === 0) {
      scheduleLeaveTimer(guildId);
    } else {
      clearLeaveTimer(guildId);
    }
  }

  async function handleVoiceStateUpdate(oldState, newState) {
    const guildId = newState?.guild?.id || oldState?.guild?.id;
    if (!guildId) return;
    const player = ctx.playerManager.getPlayer(guildId);
    if (!player) return;

    const botId = ctx.client.user?.id;
    if (newState.id === botId || oldState.id === botId) {
      clearLeaveTimer(guildId);
      return;
    }

    await evaluateAutoLeave(guildId);
  }

  async function requireVoiceForPlay(interaction) {
    const memberVoice = interaction.member?.voice?.channel;
    if (!memberVoice) {
      throw new Error('請先進入語音頻道');
    }
    return memberVoice;
  }

  async function getOrCreatePlayer(interaction) {
    const voiceChannel = await requireVoiceForPlay(interaction);
    const existing = ctx.playerManager.getPlayer(interaction.guildId);
    if (!existing) {
      return ctx.playerManager.ensurePlayer(interaction, voiceChannel.id, interaction.channelId);
    }

    if (!ctx.playerManager.canControl(interaction.member, existing, existing.queue?.current?.musicMeta?.requesterId)) {
      throw new Error('你必須與播放器同語音頻道，或具備管理員權限');
    }

    if (existing.voiceChannelId !== voiceChannel.id) {
      existing.voiceChannelId = voiceChannel.id;
      existing.textChannelId = interaction.channelId;
      await existing.connect();
      await ctx.playerManager.touchVoiceState(interaction.guildId, {
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channelId,
        panelChannelId: interaction.channelId,
      });
    }

    return existing;
  }

  async function ensureJoinAllowed(interaction) {
    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!player || (!player.playing && !player.queue?.current)) {
      throw new Error('目前沒有播放中的歌曲，無法強制加入');
    }
    const member = interaction.member;
    if (!ctx.playerManager.canControl(member, player, player.queue?.current?.musicMeta?.requesterId)) {
      throw new Error('你必須與播放器同語音頻道，或具備管理員權限');
    }
    return player;
  }

  async function joinCurrentChannel(interaction) {
    const player = await ensureJoinAllowed(interaction);
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) throw new Error('請先進入語音頻道');
    if (player.voiceChannelId === voiceChannel.id) return player;

    player.voiceChannelId = voiceChannel.id;
    player.textChannelId = interaction.channelId;
    await player.connect();
    await ctx.playerManager.touchVoiceState(interaction.guildId, {
      voiceChannelId: voiceChannel.id,
      textChannelId: interaction.channelId,
      panelChannelId: interaction.channelId,
    });
    clearLeaveTimer(interaction.guildId);
    return player;
  }

  async function leavePlayer(interaction, { clearQueue = false, announce = false } = {}) {
    const player = ctx.playerManager.getPlayer(interaction.guildId);
    if (!player) throw new Error('目前沒有播放器');

    const state = await ctx.playerManager.getGuildState(interaction.guildId);
    const channelId = state?.state?.textChannelId || interaction.channelId;
    const channel = interaction.guild.channels.cache.get(channelId);

    if (clearQueue) {
      await ctx.queueManager.clearQueueAndHistory(player).catch(() => {});
    }

    await ctx.playerManager.destroy(player, 'manual-leave', { clearState: true, clearQueue: false });
    await ctx.playerManager.clearPanelRefs(interaction.guildId).catch(() => {});
    clearLeaveTimer(interaction.guildId);

    if (announce && channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🚶 機器人已離開')
        .setDescription('已停止播放並離開語音頻道。')
        .setTimestamp();
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  function getLeaveTimerCount() {
    return leaveTimers.size;
  }

  return {
    clearLeaveTimer,
    scheduleLeaveTimer,
    handleVoiceStateUpdate,
    requireVoiceForPlay,
    getOrCreatePlayer,
    joinCurrentChannel,
    leavePlayer,
    ensureJoinAllowed,
    evaluateAutoLeave,
    getLeaveTimerCount,
  };
}

module.exports = createVoiceManager;
