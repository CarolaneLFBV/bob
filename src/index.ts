import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { connectDatabase } from './database/connection';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { Command } from './types/command';

// Validate environment variables
function validateEnv() {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'MONGODB_URI'] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`❌ Missing required environment variable: ${key}`);
    }
  }
}

async function main() {
  try {
    console.log('🚀 Starting Discord bot...\n');

    // Validate environment
    validateEnv();

    // Connect to MongoDB
    await connectDatabase();

    // Create Discord client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
    }) as Client & { commands: Collection<string, Command> };

    // Initialize commands collection
    client.commands = new Collection();

    // Load commands and events
    await loadCommands(client);
    await loadEvents(client);

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);

  } catch (error) {
    console.error('❌ Fatal error starting bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the bot
main();
