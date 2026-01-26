import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { createErrorEmbed } from '../../utils/embeds';

// Configuration de l'API
const API_BASE_URL = 'https://www.lesfousdubus.com/api';
const SITE_BASE_URL = 'https://www.lesfousdubus.com';

// Interface pour les données membre de l'API
interface MemberData {
  _id: string;
  slug: string;
  firstName: string;
  lastName: string;
  role: string;
  photo?: string;
  shortBio?: string;
  bio?: string;
  expertise: string[];
  socials?: Record<string, string>;
  isActive?: boolean;
}

// Mapping des icônes pour les réseaux sociaux
const SOCIAL_EMOJIS: Record<string, string> = {
  youtube: '🎬',
  instagram: '📸',
  tiktok: '🎵',
  twitch: '🎮',
  twitter: '🐦',
  github: '💻',
  linkedin: '💼',
  website: '🌐',
};

/**
 * Fetch avec timeout
 */
async function fetchWithTimeout(url: string, timeout = 2500): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LFDB-Discord-Bot/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Récupère les données d'un membre depuis l'API
 */
async function fetchMemberData(slug: string): Promise<MemberData | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/members/slug/${slug}`, 5000);

    if (!response.ok) {
      console.error(`API Error for ${slug}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch member ${slug}:`, error);
    return null;
  }
}

/**
 * Formate les réseaux sociaux pour l'embed
 */
function formatSocials(socials: Record<string, string> | undefined): string {
  if (!socials || Object.keys(socials).length === 0) {
    return '*Aucun réseau social configuré*';
  }

  return Object.entries(socials)
    .filter(([, url]) => url)
    .map(([platform, url]) => {
      const emoji = SOCIAL_EMOJIS[platform] || '🔗';
      const label = platform.charAt(0).toUpperCase() + platform.slice(1);
      return `${emoji} [${label}](${url})`;
    })
    .join('\n');
}

/**
 * Crée les boutons pour les liens du membre
 */
function createSocialButtons(socials: Record<string, string> | undefined, slug: string): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const buttons: ButtonBuilder[] = [];

  // Bouton vers le profil web
  buttons.push(
    new ButtonBuilder()
      .setLabel('Voir le profil')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.lesfousdubus.com/membres/${slug}`)
      .setEmoji('👤')
  );

  if (socials) {
    if (socials.youtube) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('YouTube')
          .setStyle(ButtonStyle.Link)
          .setURL(socials.youtube)
          .setEmoji('🎬')
      );
    }

    if (socials.instagram) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Instagram')
          .setStyle(ButtonStyle.Link)
          .setURL(socials.instagram)
          .setEmoji('📸')
      );
    }

    if (socials.tiktok) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('TikTok')
          .setStyle(ButtonStyle.Link)
          .setURL(socials.tiktok)
          .setEmoji('🎵')
      );
    }

    if (socials.twitch) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Twitch')
          .setStyle(ButtonStyle.Link)
          .setURL(socials.twitch)
          .setEmoji('🎮')
      );
    }
  }

  // Discord limite à 5 boutons par row
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      buttons.slice(i, i + 5)
    );
    rows.push(row);
  }

  return rows;
}

/**
 * Récupère tous les membres depuis l'API
 */
async function fetchAllMembers(): Promise<MemberData[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/members`, 5000);
    if (!response.ok) return [];
    const members = await response.json();
    return members.filter((m: MemberData) => m.isActive !== false);
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return [];
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('membre')
    .setDescription('Affiche les informations d\'un membre du collectif LFDB')
    .addStringOption((option) =>
      option
        .setName('prenom')
        .setDescription('Prénom ou pseudo du membre (ex: carolane, zalou)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const prenom = interaction.options.getString('prenom', true).toLowerCase();

    await interaction.deferReply();

    try {
      // Chercher le membre par prénom ou slug
      const members = await fetchAllMembers();
      const search = prenom.toLowerCase();

      const member = members.find(m =>
        m.firstName.toLowerCase() === search ||
        m.slug.toLowerCase() === search ||
        m.slug.toLowerCase().startsWith(search + '-')
      );

      if (!member) {
        return interaction.editReply({
          embeds: [
            createErrorEmbed(
              'Membre introuvable',
              `Aucun membre trouvé avec le prénom **${prenom}**.`
            ),
          ],
        });
      }

      // Créer l'embed avec les données du membre
      const embed = new EmbedBuilder()
        .setColor(0x9333ea) // Purple LFDB
        .setTitle(`${member.firstName} ${member.lastName}`)
        .setDescription(member.bio || member.shortBio || '*Aucune bio disponible*')
        .setThumbnail(
          member.photo
            ? member.photo.startsWith('http')
              ? member.photo
              : `${SITE_BASE_URL}${member.photo}`
            : `${SITE_BASE_URL}/images/members/default.svg`
        )
        .addFields(
          {
            name: '🎭 Rôle',
            value: member.role || 'Membre du collectif',
            inline: true,
          },
          {
            name: '✨ Expertise',
            value: member.expertise?.length > 0
              ? member.expertise.map(e => `\`${e}\``).join(' ')
              : '*Non définie*',
            inline: true,
          },
          {
            name: '🔗 Réseaux sociaux',
            value: formatSocials(member.socials),
            inline: false,
          }
        )
        .setFooter({
          text: 'Les Fous du Bus Production',
          iconURL: 'https://www.lesfousdubus.com/favicon.ico',
        })
        .setTimestamp();

      // Créer les boutons de liens
      const buttonRows = createSocialButtons(member.socials, member.slug);

      await interaction.editReply({
        embeds: [embed],
        components: buttonRows,
      });
    } catch (error) {
      console.error('❌ Error in membre command:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Erreur',
            'Une erreur est survenue lors de la récupération des informations.'
          ),
        ],
      });
    }
  },
};
