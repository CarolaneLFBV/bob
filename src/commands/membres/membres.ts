import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../types/command';
import { createErrorEmbed } from '../../utils/embeds';

// Configuration de l'API
const API_BASE_URL = 'https://www.lesfousdubus.com/api';

// Interface pour les données membre de l'API
interface MemberData {
  _id: string;
  slug: string;
  firstName: string;
  lastName: string;
  role: string;
  photo?: string;
  shortBio?: string;
  expertise: string[];
  socials?: Record<string, string>;
  order?: number;
  isActive?: boolean;
}

// Emojis pour les rôles
const ROLE_EMOJIS: Record<string, string> = {
  'Co-fondateur': '👑',
  'Co-fondatrice': '👑',
  'Expert': '⚡',
  'Membre': '🌟',
};

/**
 * Récupère tous les membres depuis l'API
 */
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

/**
 * Obtient l'emoji correspondant au rôle
 */
function getRoleEmoji(role: string): string {
  for (const [key, emoji] of Object.entries(ROLE_EMOJIS)) {
    if (role.toLowerCase().includes(key.toLowerCase())) {
      return emoji;
    }
  }
  return '🌟';
}

/**
 * Compte le nombre de réseaux sociaux
 */
function countSocials(socials?: Record<string, string>): number {
  if (!socials) return 0;
  return Object.values(socials).filter(v => v).length;
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

      // Trier par ordre si disponible
      members.sort((a, b) => (a.order || 99) - (b.order || 99));

      // Créer l'embed principal
      const embed = new EmbedBuilder()
        .setColor(0x9333ea)
        .setTitle('👥 Les Fous du Bus Production')
        .setDescription(
          `Le collectif de créateurs qui révolutionne le développement avec l'IA.\n\n` +
          `**${members.length} membres actifs**\n\n` +
          `Utilisez \`/membre <nom>\` pour voir le profil détaillé d'un membre.`
        )
        .setThumbnail('https://www.lesfousdubus.com/favicon.ico')
        .setTimestamp()
        .setFooter({
          text: 'lesfousdubus.com',
          iconURL: 'https://www.lesfousdubus.com/favicon.ico',
        });

      // Ajouter chaque membre comme un field
      for (const member of members) {
        const emoji = getRoleEmoji(member.role);
        const socialCount = countSocials(member.socials);
        const expertisePreview = member.expertise?.slice(0, 3).join(', ') || 'N/A';

        embed.addFields({
          name: `${emoji} ${member.firstName} ${member.lastName}`,
          value: [
            `**${member.role}**`,
            member.shortBio ? `> ${member.shortBio.substring(0, 80)}${member.shortBio.length > 80 ? '...' : ''}` : '',
            `🏷️ ${expertisePreview}${member.expertise?.length > 3 ? ` (+${member.expertise.length - 3})` : ''}`,
            `🔗 ${socialCount} réseaux sociaux`,
          ].filter(Boolean).join('\n'),
          inline: true,
        });
      }

      // Bouton vers le site
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Voir sur le site')
          .setStyle(ButtonStyle.Link)
          .setURL('https://www.lesfousdubus.com/membres')
          .setEmoji('🌐'),
        new ButtonBuilder()
          .setLabel('Rejoindre Discord')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/lesfousdubus')
          .setEmoji('💬')
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
} satisfies Command;
