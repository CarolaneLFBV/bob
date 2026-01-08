import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';

export default {
  data: new SlashCommandBuilder()
    .setName('lfdbp')
    .setDescription('Lien vers le site des Fous du Bus'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle('Les Fous du Bus')
      .setDescription('Retrouve toutes les infos sur notre site officiel !')
      .setURL('https://www.lesfousdubus.com')
      .setTimestamp();

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Visiter le site')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.lesfousdubus.com')
        .setEmoji('🚌')
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  },
} satisfies Command;
