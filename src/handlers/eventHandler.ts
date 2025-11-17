import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Event } from '../types/event';

export async function loadEvents(client: Client) {
  const eventsPath = join(__dirname, '../events');
  const eventFolders = readdirSync(eventsPath);

  let eventCount = 0;

  for (const folder of eventFolders) {
    const folderPath = join(eventsPath, folder);
    const eventFiles = readdirSync(folderPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of eventFiles) {
      try {
        const eventModule = await import(join(folderPath, file));
        const event: Event = eventModule.default;

        if (event && event.name && event.execute) {
          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
          } else {
            client.on(event.name, (...args) => event.execute(...args));
          }
          eventCount++;
        } else {
          console.warn(`⚠️  Event ${file} is missing required properties`);
        }
      } catch (error) {
        console.error(`❌ Failed to load event ${file}:`, error);
      }
    }
  }

  console.log(`✅ Loaded ${eventCount} events`);
}
