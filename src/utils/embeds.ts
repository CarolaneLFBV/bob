import { EmbedBuilder, GuildMember } from 'discord.js';

/**
 * Replace variables in text with dynamic values
 */
export function replaceVariables(text: string, member: GuildMember): string {
  return text
    .replace(/{user}/g, member.user.username)
    .replace(/{user\.mention}/g, `<@${member.id}>`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString())
    .replace(/{user\.tag}/g, member.user.tag);
}

/**
 * Create a success embed
 */
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#57F287')
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create an error embed
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create an info embed
 */
export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}
