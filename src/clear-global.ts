import { REST, Routes } from 'discord.js';

async function clearGlobalCommands() {
  try {
    console.log('🧹 Clearing global commands...\n');

    // Validate environment
    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      throw new Error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
    }

    // Create REST client
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // Clear all global commands
    console.log('⏳ Removing all global commands...');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: [] }
    );

    console.log('✅ All global commands have been removed!\n');
    console.log('💡 Your guild-specific commands are still active on your server.');
    console.log('🎯 You should now see only ONE set of commands on Discord!\n');

  } catch (error) {
    console.error('❌ Error clearing commands:', error);
    process.exit(1);
  }
}

clearGlobalCommands();
