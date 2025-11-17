import { Client, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from '../types/command';

export async function loadCommands(client: Client & { commands: Collection<string, Command> }) {
  const commandsPath = join(__dirname, '../commands');
  const commandFolders = readdirSync(commandsPath);

  let commandCount = 0;

  for (const folder of commandFolders) {
    const folderPath = join(commandsPath, folder);
    const commandFiles = readdirSync(folderPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const commandModule = await import(join(folderPath, file));
        const command: Command = commandModule.default;

        if (command && command.data && command.execute) {
          client.commands.set(command.data.name, command);
          commandCount++;
        } else {
          console.warn(`⚠️  Command ${file} is missing required properties`);
        }
      } catch (error) {
        console.error(`❌ Failed to load command ${file}:`, error);
      }
    }
  }

  console.log(`✅ Loaded ${commandCount} commands`);
}
