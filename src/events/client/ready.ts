import { Client, ActivityType } from 'discord.js';
import { Event } from '../../types/event';

export default {
  name: 'ready',
  once: true,
  execute(client: Client) {
    if (!client.user) return;

    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`👥 Serving ${client.users.cache.size} user(s)`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: 'les tickets 🎫', type: ActivityType.Watching }],
      status: 'online',
    });
  },
} satisfies Event<'ready'>;
