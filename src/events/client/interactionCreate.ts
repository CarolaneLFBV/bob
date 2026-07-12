import {
  Interaction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { Event } from '../../types/event';
import { Ticket } from '../../database/models/Ticket';
import { TicketConfig } from '../../database/models/TicketConfig';
import { Snippet, SnippetCounter } from '../../database/models/Snippet';
import { buildSnippetEmbed } from '../../commands/dev/snippet';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embeds';

export default {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    const client = interaction.client as any;

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const command = client.commands?.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`❌ Error in autocomplete for ${interaction.commandName}:`, error);
      }
      return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands?.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: '❌ Cette commande n\'existe pas.', ephemeral: true });
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

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'snippet_save_modal') {
        await handleSnippetSave(interaction);
      }
      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      if (interaction.customId === 'create_ticket') {
        await handleCreateTicket(interaction);
      }
      if (interaction.customId === 'close_ticket') {
        await handleCloseTicket(interaction);
      }
      if (interaction.customId === 'confirm_close') {
        await handleConfirmClose(interaction);
      }
      if (interaction.customId === 'cancel_close') {
        await interaction.update({
          embeds: [createSuccessEmbed('Annulé', 'La fermeture du ticket a été annulée.')],
          components: [],
        });
      }
      if (interaction.customId.startsWith('snippet_delete_confirm:')) {
        await handleSnippetDeleteConfirm(interaction);
      }
      if (interaction.customId === 'snippet_delete_cancel') {
        await interaction.update({
          embeds: [createSuccessEmbed('Annulé', 'Suppression annulée.')],
          components: [],
        });
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

    const existingTicket = await Ticket.findOne({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      status: 'open',
    });

    if (existingTicket) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed('Ticket déjà existant', `Tu as déjà un ticket ouvert: <#${existingTicket.channelId}>`),
        ],
      });
    }

    const config = await TicketConfig.findOne({ guildId: interaction.guildId });
    if (!config) {
      return interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Le système de tickets n\'est pas configuré.')],
      });
    }

    config.ticketCounter += 1;
    await config.save();

    const ticketNumber = config.ticketCounter;
    const ticketName = `ticket-${ticketNumber.toString().padStart(4, '0')}`;

    const channel = await interaction.guild!.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: config.categoryId,
      permissionOverwrites: [
        { id: interaction.guild!.id, deny: [PermissionFlagsBits.ViewChannel] },
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

    if (config.supportRoleId) {
      await channel.permissionOverwrites.create(config.supportRoleId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
    }

    await Ticket.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      userId: interaction.user.id,
      ticketNumber,
      status: 'open',
      createdAt: new Date(),
    });

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Fermer le Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

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
 * Handle snippet save modal submission
 */
async function handleSnippetSave(interaction: any) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.fields.getTextInputValue('title').trim();
    const languageRaw = interaction.fields.getTextInputValue('language').trim().toLowerCase();
    const code = interaction.fields.getTextInputValue('code');

    const language = languageRaw.replace(/[^a-z0-9+#-]/g, '').slice(0, 30) || 'plaintext';

    const counter = await SnippetCounter.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $inc: { counter: 1 } },
      { upsert: true, new: true }
    );

    const snippet = await Snippet.create({
      guildId: interaction.guildId,
      snippetNumber: counter.counter,
      authorId: interaction.user.id,
      authorTag: interaction.user.tag,
      title,
      language,
      code,
    });

    await interaction.editReply({
      content: `✅ Snippet **#${snippet.snippetNumber.toString().padStart(4, '0')}** sauvegardé. Récupère-le avec \`/snippet get ${snippet.snippetNumber}\`.`,
      embeds: [buildSnippetEmbed(snippet)],
    });

    console.log(`✅ Snippet #${snippet.snippetNumber} created by ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Error saving snippet:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Erreur', 'Impossible de sauvegarder le snippet.')],
      });
    }
  }
}

/**
 * Handle snippet delete confirmation
 */
async function handleSnippetDeleteConfirm(interaction: any) {
  try {
    const number = parseInt(interaction.customId.split(':')[1], 10);
    const snippet = await Snippet.findOne({ guildId: interaction.guildId, snippetNumber: number });

    if (!snippet) {
      return interaction.update({
        embeds: [createErrorEmbed('Introuvable', 'Ce snippet n\'existe plus.')],
        components: [],
      });
    }

    if (snippet.authorId !== interaction.user.id) {
      return interaction.update({
        embeds: [createErrorEmbed('Non autorisé', 'Tu ne peux supprimer que tes propres snippets.')],
        components: [],
      });
    }

    await Snippet.deleteOne({ _id: snippet._id });

    await interaction.update({
      embeds: [
        createSuccessEmbed('Snippet supprimé', `Le snippet **#${number} — ${snippet.title}** a été supprimé.`),
      ],
      components: [],
    });
  } catch (error) {
    console.error('❌ Error deleting snippet:', error);
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

    await Ticket.findOneAndUpdate({ channelId: interaction.channelId }, { status: 'closed' });

    const channel = interaction.channel as TextChannel;

    const closeEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🔒 Ticket Fermé')
      .setDescription(
        `Ce ticket a été fermé par ${interaction.user}.\n` + 'Le canal sera supprimé dans 5 secondes.'
      )
      .setTimestamp();

    await channel.send({ embeds: [closeEmbed] });

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
