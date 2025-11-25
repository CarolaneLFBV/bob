import {
  Interaction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Event } from '../../types/event';
import { Ticket } from '../../database/models/Ticket';
import { TicketConfig } from '../../database/models/TicketConfig';
import { VoiceConfig } from '../../database/models/VoiceConfig';
import { TempVoiceChannel } from '../../database/models/TempVoiceChannel';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const client = interaction.client as any;
      const command = client.commands?.get(interaction.commandName);

      if (!command) {
        return interaction.reply({
          content: '❌ Cette commande n\'existe pas.',
          ephemeral: true,
        });
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);
        const errorMessage = { content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

    // Handle button interactions
    if (interaction.isButton()) {
      // Create Ticket Button
      if (interaction.customId === 'create_ticket') {
        await handleCreateTicket(interaction);
      }

      // Close Ticket Button
      if (interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction);
      }

      // Confirm Close Button
      if (interaction.customId === 'confirm_close') {
        await handleConfirmClose(interaction);
      }

      // Cancel Close Button
      if (interaction.customId === 'cancel_close') {
        await interaction.update({
          embeds: [createSuccessEmbed('Annulé', 'La fermeture du ticket a été annulée.')],
          components: [],
        });
      }

      // Create Voice Channel Button
      if (interaction.customId === 'create_voice') {
        await handleCreateVoiceModal(interaction);
      }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'voice_name_modal') {
        await handleVoiceChannelCreation(interaction);
      }
    }
  },
} satisfies Event<'interactionCreate'>;

/**
 * Handle ticket creation
 */
async function handleCreateTicket(interaction: any) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Check for existing open ticket
    const existingTicket = await Ticket.findOne({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      status: 'open',
    });

    if (existingTicket) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            'Ticket déjà existant',
            `Tu as déjà un ticket ouvert: <#${existingTicket.channelId}>`
          ),
        ],
      });
    }

    // Get ticket configuration
    const config = await TicketConfig.findOne({ guildId: interaction.guildId });

    if (!config) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Le système de tickets n\'est pas configuré.')],
      });
    }

    // Increment ticket counter
    config.ticketCounter += 1;
    await config.save();

    const ticketNumber = config.ticketCounter;
    const ticketName = `ticket-${ticketNumber.toString().padStart(4, '0')}`;

    // Create ticket channel
    const channel = await interaction.guild!.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: config.categoryId,
      permissionOverwrites: [
        {
          id: interaction.guild!.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    // Add support role permissions if configured
    if (config.supportRoleId) {
      await channel.permissionOverwrites.create(config.supportRoleId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
    }

    // Save ticket to database
    await Ticket.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      userId: interaction.user.id,
      ticketNumber,
      status: 'open',
      createdAt: new Date(),
    });

    // Create close button
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Fermer le Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

    // Send ticket message with support ping
    const ticketEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🎫 Ticket #${ticketNumber}`)
      .setDescription(
        `Bienvenue ${interaction.user} !\n\n` +
        'Le support sera avec toi sous peu.\n' +
        'En attendant, décris ton problème en détail.\n\n' +
        '**Pour fermer ce ticket**, clique sur le bouton ci-dessous.'
      )
      .setFooter({ text: `Créé par ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({
      content: config.supportRoleId ? `<@&${config.supportRoleId}> 📢 Nouveau ticket !` : undefined,
      embeds: [ticketEmbed],
      components: [row],
    });

    // Confirm to user
    await interaction.editReply({
      embeds: [createSuccessEmbed('Ticket créé', `Ton ticket a été créé: ${channel}`)],
    });

    console.log(`✅ Ticket #${ticketNumber} created by ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Error creating ticket:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la création du ticket.')],
    });
  }
}

/**
 * Handle ticket close request (confirmation prompt)
 */
async function handleCloseTicket(interaction: any) {
  try {
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_close')
      .setLabel('Confirmer')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_close')
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle('⚠️ Confirmer la fermeture')
          .setDescription('Es-tu sûr de vouloir fermer ce ticket ?\nCette action est irréversible.'),
      ],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error('❌ Error in close ticket:', error);
  }
}

/**
 * Handle confirmed ticket closure
 */
async function handleConfirmClose(interaction: any) {
  try {
    await interaction.update({
      embeds: [createSuccessEmbed('Fermeture en cours...', 'Le ticket va être fermé dans quelques secondes.')],
      components: [],
    });

    // Update ticket status in database
    await Ticket.findOneAndUpdate(
      { channelId: interaction.channelId },
      { status: 'closed' }
    );

    const channel = interaction.channel as TextChannel;

    // Send closing message
    const closeEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🔒 Ticket Fermé')
      .setDescription(
        `Ce ticket a été fermé par ${interaction.user}.\n` +
        'Le canal sera supprimé dans 5 secondes.'
      )
      .setTimestamp();

    await channel.send({ embeds: [closeEmbed] });

    // Delete channel after delay
    setTimeout(async () => {
      try {
        await channel.delete();
        console.log(`✅ Ticket channel ${channel.name} deleted`);
      } catch (error) {
        console.error('❌ Error deleting ticket channel:', error);
      }
    }, 5000);
  } catch (error) {
    console.error('❌ Error confirming close:', error);
  }
}

/**
 * Show modal for voice channel name input
 */
async function handleCreateVoiceModal(interaction: any) {
  try {
    const modal = new ModalBuilder()
      .setCustomId('voice_name_modal')
      .setTitle('Créer un Salon Vocal');

    const nameInput = new TextInputBuilder()
      .setCustomId('voice_name')
      .setLabel('Nom du salon')
      .setPlaceholder('Ex: Gaming, Musique, Discussion...')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(50)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing voice modal:', error);
  }
}

/**
 * Handle voice channel creation from modal submission
 */
async function handleVoiceChannelCreation(interaction: any) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const baseName = interaction.fields.getTextInputValue('voice_name').trim();

    // Get voice configuration
    const config = await VoiceConfig.findOne({ guildId: interaction.guildId });

    if (!config) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Le système de salons vocaux n\'est pas configuré.')],
      });
    }

    // Generate unique channel name
    const channelName = await generateUniqueVoiceName(interaction.guildId!, baseName);

    // Create the voice channel
    const channel = await interaction.guild!.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: config.categoryId,
      userLimit: config.defaultUserLimit,
      permissionOverwrites: [
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    // Save to database
    await TempVoiceChannel.create({
      guildId: interaction.guildId!,
      channelId: channel.id,
      creatorId: interaction.user.id,
      baseName: baseName,
      createdAt: new Date(),
    });

    // Move user to the channel if they're in a voice channel
    const member = interaction.member;
    if (member?.voice?.channel) {
      try {
        await member.voice.setChannel(channel);
      } catch {
        // User might have disconnected, ignore
      }
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          'Salon créé',
          `Ton salon vocal **${channelName}** a été créé !\n\n` +
          `Rejoins-le ici: ${channel}\n\n` +
          '*Le salon sera supprimé automatiquement quand il sera vide.*'
        ),
      ],
    });

    console.log(`🎤 Temp voice channel "${channelName}" created by ${interaction.user.tag}`);
  } catch (error) {
    console.error('Error creating voice channel:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Erreur', 'Une erreur est survenue lors de la création du salon.')],
    });
  }
}

/**
 * Generate a unique voice channel name with increment if needed
 */
async function generateUniqueVoiceName(guildId: string, baseName: string): Promise<string> {
  const baseChannelName = `Salon-${baseName}`;

  // Find all existing temp channels with the same base name
  const existing = await TempVoiceChannel.find({ guildId, baseName });

  if (existing.length === 0) {
    return baseChannelName;
  }

  // Find the next available number
  let maxNum = 1;
  for (const channel of existing) {
    // The first channel doesn't have a number, so it counts as 1
    maxNum = Math.max(maxNum, 1);
  }

  // Check for existing numbered channels in the actual Discord server
  // by looking at the database entries count
  return `${baseChannelName}-${existing.length + 1}`;
}
