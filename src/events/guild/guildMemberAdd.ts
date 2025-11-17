import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { Event } from '../../types/event';
import { WelcomeConfig } from '../../database/models/WelcomeConfig';
import { replaceVariables } from '../../utils/embeds';

export default {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    try {
      // Fetch welcome configuration for this guild
      const config = await WelcomeConfig.findOne({ guildId: member.guild.id });

      if (!config || !config.enabled) {
        return; // Welcome system not configured or disabled
      }

      // Get the welcome channel
      const channel = member.guild.channels.cache.get(config.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        console.error(`❌ Welcome channel ${config.channelId} not found or not text-based`);
        return;
      }

      // Build the welcome embed
      const embed = new EmbedBuilder()
        .setColor(config.embedColor as any)
        .setTitle(replaceVariables(config.title, member))
        .setDescription(replaceVariables(config.description, member))
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `Membre #${member.guild.memberCount}` })
        .setTimestamp();

      // Add custom image if configured
      if (config.imageUrl) {
        embed.setImage(config.imageUrl);
      }

      // Send welcome message
      await channel.send({
        content: config.mentionUser ? `<@${member.id}>` : undefined,
        embeds: [embed],
      });

      console.log(`✅ Welcome message sent for ${member.user.tag} in ${member.guild.name}`);
    } catch (error) {
      console.error('❌ Error in guildMemberAdd event:', error);
    }
  },
} satisfies Event<'guildMemberAdd'>;
