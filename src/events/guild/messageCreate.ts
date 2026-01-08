import { Message, TextChannel } from 'discord.js';
import { Event } from '../../types/event';
import { UserLevel } from '../../database/models/UserLevel';
import { LevelConfig } from '../../database/models/LevelConfig';
import { levelFromXp, randomXp } from '../../utils/levels';
import { EmbedBuilder } from 'discord.js';

export default {
  name: 'messageCreate',
  async execute(message: Message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    try {
      // Check if level system is enabled
      const config = await LevelConfig.findOne({ guildId });
      if (!config?.enabled) return;

      // Check if channel is ignored
      if (config.ignoredChannels.includes(message.channel.id)) return;

      // Check if user has an ignored role
      const member = message.member;
      if (member) {
        const hasIgnoredRole = member.roles.cache.some((role) =>
          config.ignoredRoles.includes(role.id)
        );
        if (hasIgnoredRole) return;
      }

      // Get or create user level data
      let userLevel = await UserLevel.findOne({ guildId, userId });

      if (!userLevel) {
        userLevel = new UserLevel({
          guildId,
          userId,
          xp: 0,
          level: 0,
          totalMessages: 0,
          voiceXp: 0,
          messageXp: 0,
          lastMessageAt: new Date(0),
        });
      }

      // Check cooldown
      const now = Date.now();
      const cooldownMs = config.messageCooldown * 1000;
      const timeSinceLastMessage = now - userLevel.lastMessageAt.getTime();

      if (timeSinceLastMessage < cooldownMs) {
        // Still on cooldown, just increment message count
        userLevel.totalMessages += 1;
        await userLevel.save();
        return;
      }

      // Calculate XP gain
      const xpGain = randomXp(config.xpPerMessage.min, config.xpPerMessage.max);
      const oldLevel = userLevel.level;

      // Update user data
      userLevel.xp += xpGain;
      userLevel.messageXp += xpGain;
      userLevel.totalMessages += 1;
      userLevel.lastMessageAt = new Date();
      userLevel.level = levelFromXp(userLevel.xp);
      userLevel.updatedAt = new Date();

      await userLevel.save();

      // Check for level up
      if (userLevel.level > oldLevel) {
        await handleLevelUp(message, config, userLevel.level, userId);
        await handleRoleRewards(message, config, userLevel.level);
      }
    } catch (error) {
      console.error('Error processing message XP:', error);
    }
  },
} satisfies Event<'messageCreate'>;

/**
 * Handle level up announcement
 */
async function handleLevelUp(
  message: Message,
  config: any,
  newLevel: number,
  userId: string
) {
  const levelUpMessage = config.levelUpMessage
    .replace(/{user}/g, `<@${userId}>`)
    .replace(/{level}/g, newLevel.toString());

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setDescription(levelUpMessage)
    .setTimestamp();

  try {
    // Send to announcement channel if configured, otherwise same channel
    if (config.announcementChannelId) {
      const channel = message.guild?.channels.cache.get(config.announcementChannelId) as TextChannel;
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    } else if ('send' in message.channel) {
      await message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error sending level up message:', error);
  }
}

/**
 * Handle role rewards for level up
 */
async function handleRoleRewards(message: Message, config: any, newLevel: number) {
  if (!message.member || !config.rewards.length) return;

  try {
    const guild = message.guild;
    if (!guild) return;

    // Find all rewards for this level and below
    const eligibleRewards = config.rewards.filter(
      (r: { level: number; roleId: string }) => r.level <= newLevel
    );

    if (!eligibleRewards.length) return;

    if (config.stackRewards) {
      // Add all eligible roles
      for (const reward of eligibleRewards) {
        const role = guild.roles.cache.get(reward.roleId);
        if (role && !message.member.roles.cache.has(reward.roleId)) {
          await message.member.roles.add(role);
          console.log(`🎖️ Added role ${role.name} to ${message.author.tag} (level ${newLevel})`);
        }
      }
    } else {
      // Only keep the highest level role
      const highestReward = eligibleRewards.reduce(
        (max: { level: number; roleId: string }, r: { level: number; roleId: string }) =>
          r.level > max.level ? r : max
      );

      // Remove other reward roles
      for (const reward of config.rewards) {
        if (reward.roleId !== highestReward.roleId) {
          const role = guild.roles.cache.get(reward.roleId);
          if (role && message.member.roles.cache.has(reward.roleId)) {
            await message.member.roles.remove(role);
          }
        }
      }

      // Add the highest role
      const role = guild.roles.cache.get(highestReward.roleId);
      if (role && !message.member.roles.cache.has(highestReward.roleId)) {
        await message.member.roles.add(role);
        console.log(`🎖️ Added role ${role.name} to ${message.author.tag} (level ${newLevel})`);
      }
    }
  } catch (error) {
    console.error('Error handling role rewards:', error);
  }
}
