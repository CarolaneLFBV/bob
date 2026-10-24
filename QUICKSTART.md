# 🚀 Guide de Démarrage Rapide

## Étape 1 : Configuration Discord

### Créer l'application Discord

1. Allez sur https://discord.com/developers/applications
2. Cliquez sur "New Application"
3. Nommez votre bot (ex: "Mon Bot Communautaire")
4. Allez dans l'onglet "Bot"
5. Cliquez sur "Reset Token" et **copiez le token** (vous ne pourrez le voir qu'une fois !)

### Récupérer le Client ID

1. Retournez sur l'onglet "General Information"
2. Copiez l'"Application ID" (c'est votre CLIENT_ID)

### Activer les Intents nécessaires

Dans l'onglet "Bot", activez ces intents :
- ✅ Presence Intent
- ✅ Server Members Intent
- ✅ Message Content Intent

### Inviter le bot sur votre serveur

Remplacez `YOUR_CLIENT_ID` par votre Application ID :
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

## Étape 2 : Configuration MongoDB

### Option A : MongoDB Local

```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Windows (téléchargez depuis mongodb.com)
# Linux
sudo apt-get install mongodb
sudo systemctl start mongod
```

### Option B : MongoDB Atlas (Cloud - Gratuit)

1. Allez sur https://www.mongodb.com/cloud/atlas
2. Créez un compte gratuit
3. Créez un cluster (M0 Free)
4. Créez un utilisateur de base de données
5. Whitelist votre IP (ou 0.0.0.0/0 pour tout autoriser)
6. Copiez votre Connection String

Exemple de connection string :
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/discord-bot?retryWrites=true&w=majority
```

## Étape 3 : Configuration du projet

### 1. Configurer l'environnement

Éditez `.env.local` :

```env
DISCORD_TOKEN=votre_token_copie_etape_1
DISCORD_CLIENT_ID=votre_application_id_etape_1
MONGODB_URI=mongodb://localhost:27017/discord-bot  # ou votre Atlas URI
NODE_ENV=development
```

### 2. Déployer les commandes

```bash
bun run deploy
```

Vous devriez voir :
```
✅ Loaded command: welcome-setup
✅ Loaded command: voice-setup
✅ Successfully deployed 10 global commands!
```

### 3. Lancer le bot

```bash
bun run dev
```

Vous devriez voir :
```
✅ MongoDB connected successfully
✅ Loaded 10 commands
✅ Logged in as YourBot#1234
```

## Étape 4 : Configuration sur Discord

### Configurer le système de bienvenue

1. Créez un canal texte `#bienvenue` sur votre serveur
2. Utilisez la commande :
```
/welcome-setup
  channel: #bienvenue
  title: Bienvenue {user} !
  description: Bienvenue sur **{server}** ! Tu es le membre #{memberCount} 🎉
  color: #5865F2
  mention: true
```

## ✅ Test du bot

### Tester le système de bienvenue

1. Créez un compte Discord secondaire (ou demandez à un ami)
2. Invitez ce compte sur votre serveur de test
3. Le message de bienvenue devrait apparaître dans `#bienvenue`

## 🐛 Dépannage

### Le bot ne se connecte pas

- Vérifiez que le token est correct dans `.env.local`
- Vérifiez que MongoDB est démarré
- Regardez les logs dans le terminal

### Les commandes n'apparaissent pas

- Lancez `bun run deploy` à nouveau
- Attendez quelques minutes (Discord peut mettre du temps à synchroniser)
- Vérifiez que le bot a les permissions "applications.commands"

### Le message de bienvenue ne s'envoie pas

- Vérifiez que l'intent "Server Members" est activé dans le Discord Developer Portal
- Vérifiez que la configuration existe avec `/welcome-setup`
- Vérifiez que le canal existe toujours

## 📚 Prochaines étapes

Votre bot est maintenant fonctionnel ! Vous pouvez :

- Personnaliser les messages de bienvenue
- Ajouter plus de commandes dans `src/commands/`
- Ajouter des événements dans `src/events/`
- Implémenter le système de stats (nombre de messages, top emotes)
- Ajouter un système de logs
- Ajouter un système de modération automatique

Consultez le README.md pour plus de détails sur le développement !
