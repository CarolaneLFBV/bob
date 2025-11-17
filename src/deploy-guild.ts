import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

async function deployGuildCommands() {
  try {
    console.log('🚀 Starting GUILD command deployment (instant)...\n');

    // Validate environment
    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      throw new Error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
    }

    // Get guild ID from command line or prompt
    const guildId = process.argv[2];

    if (!guildId) {
      console.error('❌ Please provide your Guild ID (Server ID)');
      console.log('\n📖 How to get your Guild ID:');
      console.log('   1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)');
      console.log('   2. Right-click your server icon');
      console.log('   3. Click "Copy Server ID"\n');
      console.log('💡 Usage: bun src/deploy-guild.ts YOUR_GUILD_ID');
      process.exit(1);
    }

    const commands: any[] = [];

    // Load all commands
    const commandsPath = join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

      for (const file of commandFiles) {
        const commandModule = await import(join(folderPath, file));
        const command = commandModule.default;

        if (command && command.data) {
          commands.push(command.data.toJSON());
          console.log(`✅ Loaded command: ${command.data.name}`);
        }
      }
    }

    console.log(`\n📦 Total commands to deploy: ${commands.length}\n`);

    // Create REST client
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    // Deploy commands to specific guild (INSTANT!)
    console.log(`⚡ Deploying commands to guild ${guildId}...`);
    console.log('   (This is INSTANT - no waiting!)\n');

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
      { body: commands }
    ) as any[];

    console.log(`✅ Successfully deployed ${data.length} commands to your server!\n`);

    console.log('📋 Deployed commands:');
    data.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });

    console.log('\n🎉 Commands are now INSTANTLY available on your Discord server!');
    console.log('💡 Type / in Discord to see them immediately!\n');

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
}

deployGuildCommands();
