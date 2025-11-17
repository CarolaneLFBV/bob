import { REST, Routes } from 'discord.js';

async function clearAllCommands() {
  try {
    console.log('🧹 Clearing ALL commands (global + guild)...\n');

    // Validate environment
    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      throw new Error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
    }

    // Get guild ID from command line
    const guildId = process.argv[2];

    if (!guildId) {
      console.error('❌ Please provide your Guild ID');
      console.log('💡 Usage: bun src/clear-all.ts YOUR_GUILD_ID\n');
      process.exit(1);
    }

    // Create REST client
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // Clear global commands
    console.log('⏳ Removing all global commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: [] }
    );
    console.log('✅ Global commands cleared!');

    // Clear guild commands
    console.log(`⏳ Removing all guild commands from ${guildId}...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
      { body: [] }
    );
    console.log('✅ Guild commands cleared!');

    console.log('\n🎉 All commands have been removed!');
    console.log('💡 Now redeploy with: bun run deploy:guild ' + guildId + '\n');

  } catch (error) {
    console.error('❌ Error clearing commands:', error);
    process.exit(1);
  }
}

clearAllCommands();
