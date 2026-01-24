import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  userPermissions?: (keyof typeof PermissionFlagsBits)[];
  botPermissions?: (keyof typeof PermissionFlagsBits)[];
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
