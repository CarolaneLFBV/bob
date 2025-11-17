import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

async function deployCommands() {
  try {
    console.log('🚀 Starting command deployment...\n');

    // Validate environment
    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
      throw new Error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment variables');
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

    // Deploy commands globally
    console.log('🌐 Deploying commands globally...');

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    ) as any[];

    console.log(`✅ Successfully deployed ${data.length} global commands!\n`);

    console.log('📋 Deployed commands:');
    data.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
}

deployCommands();
