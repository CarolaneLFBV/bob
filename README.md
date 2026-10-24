# 🤖 Discord Bot - TypeScript + Bun

Bot Discord communautaire développé avec TypeScript, Bun et MongoDB.

## ✨ Fonctionnalités

### 🎉 Système de Bienvenue
- Messages de bienvenue personnalisés avec embeds
- Variables dynamiques : `{user}`, `{user.mention}`, `{server}`, `{memberCount}`
- Configuration par serveur via `/welcome-setup`
- Avatar de l'utilisateur et compteur de membres
- Images personnalisables et couleurs d'embed

### 🎤 Salons vocaux temporaires
- Création automatique d'un salon en rejoignant le salon dédié
- Déplacement du membre dans son salon et suppression lorsque le salon est vide
- Limite de participants réglable par le créateur avec `/voice-limit`

### 🏆 Niveaux et classements
- XP gagnés grâce aux messages, avec délai configurable entre deux gains
- Rôles récompenses et annonces de passage de niveau
- `/rank`, `/leaderboard xp` et `/leaderboard messages`
- Les totaux d'XP déjà acquis sont conservés

### 📰 Veilles quotidiennes
- Tech Watch : Ars Technica, TechCrunch, Lobsters et GitHub Trending
- Apple News : MacRumors, 9to5Mac et Apple Newsroom
- Publication à 9 h, heure de Paris ; salons définis dans `src/config/`

La commande `/logs-setup` configure les journaux d’activité. Les gestionnaires présents dans `src/events/logs/` sur cette installation sont ignorés par Git : ils doivent être conservés lors du déploiement. Certains événements nécessitent les intents Discord correspondants.
Voir [COMMANDS.md](COMMANDS.md) pour le détail des commandes.

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
