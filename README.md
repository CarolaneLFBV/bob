# 🤖 Discord Bot - TypeScript + Bun

Bot Discord moderne avec système de bienvenue et ticketing, développé avec TypeScript, Bun et MongoDB.

## ✨ Fonctionnalités

### 🎉 Système de Bienvenue
- Messages de bienvenue personnalisés avec embeds
- Variables dynamiques : `{user}`, `{user.mention}`, `{server}`, `{memberCount}`
- Configuration par serveur via `/welcome-setup`
- Avatar de l'utilisateur et compteur de membres
- Images personnalisables et couleurs d'embed

### 🎫 Système de Ticketing
- Panneau persistant avec bouton de création
- Création automatique de canaux privés (`ticket-0001`, `ticket-0002`, etc.)
- Ping automatique du rôle support
- Système de confirmation pour fermeture
- Un ticket par utilisateur maximum
- Permissions automatiques (utilisateur + support + bot)

## 🚀 Installation

### Prérequis
- [Bun](https://bun.sh/) installé
- MongoDB installé et en cours d'exécution
- Application Discord créée sur le [Developer Portal](https://discord.com/developers/applications)

### 1. Installer les dépendances

```bash
bun install
```

### 2. Configuration de l'environnement

Copiez `.env.example` vers `.env.local` et remplissez les valeurs :

```env
DISCORD_TOKEN=votre_token_ici
DISCORD_CLIENT_ID=votre_client_id_ici
MONGODB_URI=mongodb://localhost:27017/discord-bot
NODE_ENV=development
```

#### Comment obtenir le token et client ID ?

1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créez une nouvelle application ou sélectionnez-en une existante
3. **Client ID** : Onglet "General Information" → Application ID
4. **Token** : Onglet "Bot" → Reset Token (gardez-le secret !)

#### Inviter le bot sur votre serveur

Utilisez cette URL (remplacez `YOUR_CLIENT_ID`) :
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

### 3. Démarrer MongoDB

```bash
# macOS (avec Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Ou utilisez MongoDB Atlas (cloud) et changez MONGODB_URI
```

### 4. Déployer les commandes slash

```bash
bun run deploy
```

### 5. Lancer le bot

```bash
# Mode développement (auto-reload)
bun run dev

# Mode production
bun run start
```

## 📖 Utilisation

### Configuration du système de bienvenue

```
/welcome-setup
  channel: #bienvenue
  title: "Bienvenue {user} sur {server} !"
  description: "Tu es le membre #{memberCount} 🎉"
  color: #5865F2
  mention: true
```

**Variables disponibles** :
- `{user}` : Nom d'utilisateur
- `{user.mention}` : Mention de l'utilisateur
- `{server}` : Nom du serveur
- `{memberCount}` : Nombre total de membres

### Configuration du système de ticketing

```
/ticket-panel
  panel-channel: #ticket-support
  category: Support
  support-role: @Support
```

Cela créera un panneau permanent dans `#ticket-support` avec un bouton pour créer des tickets.

**Workflow du ticket** :
1. L'utilisateur clique sur "🎫 Créer un Ticket"
2. Un canal privé est créé automatiquement (`ticket-0001`)
3. Le rôle support est pingé dans le nouveau ticket
4. L'utilisateur et le support peuvent communiquer
5. Fermeture via le bouton "🔒 Fermer le Ticket"
6. Confirmation requise avant suppression

## 🏗️ Structure du projet

```
discord-bot/
├── src/
│   ├── commands/admin/          # Commandes admin
│   ├── events/                  # Gestionnaires d'événements
│   ├── handlers/                # Chargeurs
│   ├── database/                # MongoDB + Mongoose
│   ├── utils/                   # Utilitaires
│   ├── types/                   # Types TypeScript
│   ├── index.ts                 # Point d'entrée
│   └── deploy-commands.ts       # Déploiement commandes
├── .env.local                   # Variables d'environnement
└── package.json
```

## 🛠️ Scripts disponibles

```bash
bun run dev      # Développement avec auto-reload
bun run start    # Production
bun run deploy   # Déployer les commandes slash
```

## 🔒 Sécurité

- ✅ Token stocké dans `.env.local` (gitignore)
- ✅ Validation des permissions utilisateur
- ✅ Vérification des permissions bot
- ✅ Input validation sur toutes les commandes
- ✅ Logs sécurisés sans exposition de données sensibles

## 📝 License

MIT
