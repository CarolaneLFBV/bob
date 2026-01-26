import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { createErrorEmbed } from '../../utils/embeds';

const API_BASE_URL = 'https://www.lesfousdubus.com/api';

interface MemberData {
  _id: string;
  slug: string;
  firstName: string;
  lastName: string;
  role: string;
  photo?: string;
  shortBio?: string;
  expertise: string[];
  isActive?: boolean;
}

async function fetchAllMembers(): Promise<MemberData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/members`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LFDB-Discord-Bot/1.0',
      },
    });

    if (!response.ok) {
      console.error(`API Error: ${response.status}`);
      return [];
    }

    const members = await response.json();
    return members.filter((m: MemberData) => m.isActive !== false);
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return [];
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('membres')
    .setDescription('Affiche tous les membres du collectif LFDB'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const members = await fetchAllMembers();

      if (members.length === 0) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              'Aucun membre trouvé',
              'Impossible de récupérer la liste des membres depuis le site.'
            ),
          ],
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9333ea)
        .setTitle('👥 Les Fous du Bus Production')
        .setDescription(
          `**${members.length} membres actifs**\n\n` +
          members.map(m => `• **${m.firstName} ${m.lastName}** - ${m.role}`).join('\n') +
          `\n\nUtilise \`/membre <nom>\` pour voir un profil détaillé.`
        )
        .setThumbnail('https://www.lesfousdubus.com/favicon.ico')
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Voir sur le site')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.lesfousdubus.com/membres')
          .setEmoji('🌐')
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    } catch (error) {
      console.error('❌ Error in membres command:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Erreur',
            'Une erreur est survenue lors de la récupération des membres.'
          ),
        ],
      });
    }
  },
};
