# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Running the bot:**
```bash
bun run dev          # Development mode with auto-reload (--watch flag)
bun run start        # Production mode
```

**Command deployment:**
```bash
bun run deploy:guild <GUILD_ID>    # Deploy to specific guild (INSTANT, recommended for development)
bun run deploy                      # Deploy globally (takes ~1 hour to sync, avoid for development)
bun run clear:global                # Remove all global commands only
bun run clear:all <GUILD_ID>        # Remove ALL commands (global + guild), then redeploy
```

**Important:** After creating/modifying commands, you MUST:
1. Deploy commands with `bun run deploy:guild <GUILD_ID>`
2. Restart the bot process to load the new command handlers

The bot does NOT auto-reload commands while running. If you deploy a new command and it shows "Cette commande n'existe pas", kill the dev process and restart it.

## Architecture Overview

### Auto-Loading Handler System

This bot uses a **dynamic handler architecture** that automatically discovers and loads commands and events at runtime:

**Command Handler** (`src/handlers/commandHandler.ts`):
- Recursively scans `src/commands/*/` folders
- Auto-imports all `.ts`/`.js` files
- Registers commands in `client.commands` Collection
- Validates each command has `data` and `execute` properties

**Event Handler** (`src/handlers/eventHandler.ts`):
- Scans `src/events/*/` folders
- Auto-imports event files
- Dynamically registers event listeners on the Discord client
- Each event exports `name` and `execute` function

**Key Implication:** To add new commands or events, simply create a new file in the appropriate folder. No manual registration needed.

### Command Structure

All commands follow this interface (`src/types/command.ts`):

```typescript
export interface Command {
  data: SlashCommandBuilder;          // Discord.js command definition
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
```

Commands are organized by category in `src/commands/<category>/`:
- `admin/` - Server management commands (require ManageGuild permission)

Each command file exports a default object satisfying the `Command` interface.

### Event-Driven Interaction Handling

**Critical File:** `src/events/client/interactionCreate.ts`

This single event handler manages ALL user interactions:

1. **Slash Commands** - Routes to appropriate command from `client.commands` Collection
### Database Models (MongoDB + Mongoose)

**Per-Guild Configuration Pattern:**

All models use `guildId` as the primary identifier to support multi-server deployments:

- **WelcomeConfig** - Welcome message settings (one per guild)
  - `guildId: string` (unique)
  - Dynamic variable support: `{user}`, `{user.mention}`, `{server}`, `{memberCount}`

**MongoDB Connection:** Auto-loads from `MONGODB_URI` environment variable. Supports both local MongoDB and MongoDB Atlas cloud.

### Environment Configuration

**Required Variables** (`.env.local`):
```env
DISCORD_TOKEN=...           # Bot token from Discord Developer Portal
DISCORD_CLIENT_ID=...       # Application ID from Discord Developer Portal
MONGODB_URI=...             # MongoDB connection string
NODE_ENV=development        # Environment mode
```

**Bun Auto-Loads `.env` Files** - No `dotenv` package needed. Bun natively loads `.env.local` (gitignored) and `.env` files.

### Discord Intents Configuration

The bot requires these gateway intents (`src/index.ts:30-34`):

```typescript
GatewayIntentBits.Guilds          // Required for basic guild operations
GatewayIntentBits.GuildMembers    // Required for welcome messages (guildMemberAdd event)
GatewayIntentBits.GuildMessages   // Required for message operations
```

**IMPORTANT:** These intents MUST be enabled in the Discord Developer Portal:
- Bot → Privileged Gateway Intents → Enable "Server Members Intent" and "Message Content Intent"

If intents are not enabled, the bot will throw "Used disallowed intents" error on startup.

### Variable Replacement System

Welcome messages support dynamic variables (`src/utils/embeds.ts:replaceVariables`):

```typescript
{user}          → username (e.g., "JohnDoe")
{user.mention}  → user ping (e.g., "<@123456789>")
{server}        → guild name (e.g., "My Server")
{memberCount}   → total member count (e.g., "42")
```

Variables are replaced at runtime in both title and description fields.

### Color Palette

The bot uses the **Nature Fresh** palette consistently across embeds:

```
Primary:   #2ECC71 (Green)
Secondary: #27AE60 (Darker Green)
Tertiary:  #1ABC9C (Teal)
Accent:    #16A085 (Dark Teal)
Warnings:  #F39C12 (Orange) / #E67E22 (Dark Orange)
Errors:    #D35400 (Red Orange)
Info:      #8E44AD (Purple) / #2980B9 (Blue)
Neutral:   #ECF0F1 (Light Gray)
```

Use `createSuccessEmbed()` and `createErrorEmbed()` utility functions for consistent styling.

### Deployment Strategy

**Development (Recommended):**
```bash
bun run deploy:guild 1390017627715403776  # Instant sync to specific server
```

**Production:**
```bash
bun run deploy  # Global deployment, 1 hour sync time
```

**Why Guild-Specific?**
- Updates appear INSTANTLY on your development server
- Global commands take ~1 hour to sync across all Discord servers
- Avoid duplicate commands by using either guild OR global, not both

**If Commands Appear Duplicated:**
This happens when both global and guild commands exist. Fix:
```bash
bun run clear:all 1390017627715403776
bun run deploy:guild 1390017627715403776
```

### Adding New Commands

1. Create file in `src/commands/<category>/<command-name>.ts`
2. Export default object implementing `Command` interface:
```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types/command';

export default {
  data: new SlashCommandBuilder()
    .setName('command-name')
    .setDescription('Command description'),

  async execute(interaction: ChatInputCommandInteraction) {
    // Command logic here
  },
} satisfies Command;
```
3. Deploy: `bun run deploy:guild <GUILD_ID>`
4. Restart bot: Kill and restart `bun run dev`

**No manual registration needed** - the command handler auto-discovers it.

### Adding New Events

1. Create file in `src/events/<category>/<event-name>.ts`
2. Export default object implementing `Event<'eventName'>`:
```typescript
import { Event } from '../../types/event';

export default {
  name: 'eventName',
  async execute(...args) {
    // Event logic here
  },
} satisfies Event<'eventName'>;
```

**No manual registration needed** - the event handler auto-discovers it.

### Error Handling Patterns

**Commands:**
- Always use `await interaction.deferReply({ ephemeral: true })` for long operations
- Check if already replied before sending: `interaction.replied || interaction.deferred`
- Use `createErrorEmbed()` for consistent error messages

**Database Operations:**
- Always wrap in try-catch
- Log errors with console.error() including context
- Return user-friendly error messages

**Button Interactions:**
- Use ephemeral messages for confirmations
- Update original message with `.update()` instead of creating new messages

### Common Patterns

**Checking Permissions:**
```typescript
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
```

**Getting Guild Configuration:**
```typescript
const config = await WelcomeConfig.findOne({ guildId: interaction.guildId });
if (!config) {
  return interaction.editReply({
    embeds: [createErrorEmbed('Erreur', 'Système non configuré.')],
  });
}
```

**Creating Embeds:**
```typescript
import { createSuccessEmbed, createErrorEmbed } from '../../utils/embeds';

// Success
createSuccessEmbed('Titre', 'Description')

// Error
createErrorEmbed('Titre', 'Description')

// Custom
new EmbedBuilder()
  .setColor('#2ECC71')
  .setTitle('Titre')
  .setDescription('Description')
```

**Validating Input:**
```typescript
// Hex color validation
if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
  return interaction.editReply({
    embeds: [createErrorEmbed('Erreur', 'Format invalide.')],
  });
}
```

## TypeScript Configuration

The project uses ESM modules (`"type": "module"` in package.json). All imports must use `.js` extension in production, but `.ts` during development with Bun.

Bun handles TypeScript natively - no separate compilation step needed.
