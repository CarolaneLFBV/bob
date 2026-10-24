import type { Interaction } from 'discord.js';
import type { Event } from '../../types/event';

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
  },
} satisfies Event<'interactionCreate'>;
