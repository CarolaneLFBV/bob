# 📖 Guide des Commandes - Bob

Documentation complète de toutes les commandes disponibles pour Bob.

---

## 🎉 Système de Bienvenue

### `/welcome-setup`
**Créer ou reconfigurer complètement le système de bienvenue**

**Permissions requises** : Gérer le serveur

**Options** :
| Option | Type | Requis | Description |
|--------|------|--------|-------------|
| `channel` | Canal | ✅ Oui | Canal où envoyer les messages de bienvenue |
| `title` | Texte | ❌ Non | Titre du message (défaut: "Bienvenue {user} !") |
| `description` | Texte | ❌ Non | Description du message |
| `color` | Texte | ❌ Non | Couleur de l'embed en hexadécimal (ex: #2ECC71) |
| `image` | Texte | ❌ Non | URL de l'image de fond |
| `mention` | Booléen | ❌ Non | Mentionner l'utilisateur dans le message |
| `enabled` | Booléen | ❌ Non | Activer ou désactiver le système |

**Variables disponibles** :
- `{user}` - Nom d'utilisateur
- `{user.mention}` - Mention de l'utilisateur (@User)
- `{server}` - Nom du serveur
- `{memberCount}` - Nombre total de membres

**Exemples** :
```
/welcome-setup
  channel: #🛬・aeroport
  title: {user} vient d'atterrir ! ✈️
  description: Bienvenue ! Tu es le passager #{memberCount} 🎉
  color: #2ECC71
  mention: true
```

---

### `/welcome-edit`
**Modifier la configuration existante**

**Permissions requises** : Gérer le serveur

**Options** :
| Option | Type | Requis | Description |
|--------|------|--------|-------------|
| `channel` | Canal | ❌ Non | Nouveau canal de bienvenue |
| `title` | Texte | ❌ Non | Nouveau titre |
| `description` | Texte | ❌ Non | Nouvelle description |
| `color` | Texte | ❌ Non | Nouvelle couleur (format hex) |
| `image` | Texte | ❌ Non | Nouvelle URL d'image |
| `mention` | Booléen | ❌ Non | Modifier la mention utilisateur |
| `enabled` | Booléen | ❌ Non | Activer/désactiver |

**Utilisation** :
- Seuls les paramètres renseignés seront modifiés
- Les autres paramètres restent inchangés
- Parfait pour modifier juste un ou deux éléments

**Exemples** :
```
# Changer seulement la couleur
/welcome-edit color:#1ABC9C

# Changer le titre et désactiver les mentions
/welcome-edit
  title: Nouveau titre
  mention: false

# Changer l'image
/welcome-edit image:https://i.imgur.com/exemple.png
```

---

### `/welcome-toggle`
**Activer ou désactiver rapidement le système de bienvenue**

**Permissions requises** : Gérer le serveur

**Options** : Aucune

**Comportement** :
- Si activé → désactive
- Si désactivé → active
- Toggle simple en un clic

**Exemples** :
```
/welcome-toggle
```

---

### `/welcome-view`
**Voir la configuration actuelle du système de bienvenue**

**Permissions requises** : Gérer le serveur

**Options** : Aucune

**Affiche** :
- ✅ Statut (activé/désactivé)
- 📍 Canal configuré
- 💬 Titre et description actuels
- 🎨 Couleur de l'embed
- 🖼️ Image configurée (si définie)
- 📢 Mention activée ou non

**Exemples** :
```
/welcome-view
```

---

## 🎤 Salons vocaux temporaires

- `/voice-setup category:<catégorie> [user-limit:<0–99>]` : crée le salon « Créer un salon temporaire ». Permission : Gérer le serveur.
- Rejoindre ce salon crée un salon personnel et y déplace le membre. Le salon est supprimé lorsqu'il est vide.
- `/voice-limit [limite:<0–99>]` : modifie la capacité de son salon temporaire. Réservé à son créateur ; 0 ou aucune valeur signifie illimité.

---

## 🏆 Niveaux et classements

L'XP est attribuée pour les messages, avec un délai entre deux gains. Les totaux d'XP déjà acquis sont conservés.

- `/rank [user:<membre>]` : niveau, XP, progression et rang.
- `/leaderboard xp [page:<numéro>]` : classement par XP.
- `/leaderboard messages [page:<numéro>]` : classement des messages comptabilisés par le système de niveaux.

Configuration via `/level-setup` (permission : Gérer le serveur) :

- `enable` / `disable` : activer ou désactiver les niveaux.
- `channel [channel:<salon>]` : choisir le salon d'annonce ; sans option, le salon du message est utilisé.
- `xp [message_min:<nombre>] [message_max:<nombre>] [cooldown:<secondes>]` : régler les gains et leur délai.
- `reward level:<niveau> role:<rôle>` / `remove-reward level:<niveau>` : gérer les récompenses.
- `ignore-channel channel:<salon>` / `ignore-role role:<rôle>` : ajouter ou retirer une exclusion.
- `message message:<texte>` : personnaliser l'annonce avec `{user}` et `{level}`.
- `view` : consulter la configuration.

---

## 📰 Publications automatiques

Les deux veilles sont publiées chaque jour à **9 h, heure de Paris** :

- **Tech Watch** : sélection Ars Technica, TechCrunch, Lobsters et GitHub Trending. Salon configuré dans `src/config/techwatch.ts`.
- **Apple News** : sélection MacRumors, 9to5Mac et Apple Newsroom, avec mention du rôle configuré dans `src/config/appleNews.ts`.

Ces publications n'ont pas de commande slash de configuration.

---

## ⚙️ Journaux d’activité

`/logs-setup` permet de configurer un salon, les types d'événements et les exclusions. Les gestionnaires présents sur cette installation couvrent les arrivées/départs, modifications/suppressions de messages, mouvements vocaux, changements de rôles/pseudos et bannissements/débannissements. Leur fonctionnement dépend des intents et permissions Discord nécessaires.

Les fichiers de `src/events/logs/` sont actuellement ignorés par Git ; un déploiement à partir du seul dépôt ne les inclut pas.

---

## 📰 Notifications Articles & Keepio

Bob annonce automatiquement dans le salon des annonces, en mentionnant uniquement le rôle concerné (pas de `@here`) :
- **Nouvel article** sur carolanelefebvre.com (+ `@🍎・Curious`, le rôle des news Apple) — uniquement à la première publication. Les brouillons, mises à jour et republications ne déclenchent rien (Bob lit le champ `announcedAt` des articles dans la base `portfolio`, vérifiée chaque minute).
- **Nouvelle version de Keepio iOS** sur l'App Store (+ `@Keepio iOS`) — vérifiée toutes les 10 minutes via l'API iTunes. Le cache d'Apple peut retarder la détection de quelques heures après la sortie.
- **Nouvelle version de Keepio Android** sur Google Play (+ `@Keepio Android`) — vérifiée toutes les 10 minutes via l'API Google Play Developer, piste **production** uniquement (les tests fermés ne sont pas annoncés). La première mise en production sera annoncée.

**Configuration Android** (`.env.local`) :
1. Google Cloud Console : activer l'API *Google Play Android Developer*, créer un compte de service et télécharger sa clé JSON.
2. Play Console → Utilisateurs et autorisations : inviter l'e-mail du compte de service avec l'autorisation *Afficher les informations sur l'application* sur Keepio.
3. Renseigner `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE` (chemin de la clé JSON, jamais commitée) et `KEEPIO_ANDROID_PACKAGE` (nom de package de Keepio), puis relancer `/notif-setup enable`.

### `/notif-setup`
**Configurer les notifications**

**Permissions requises** : Gérer le serveur

**Sous-commandes** :
| Sous-commande | Description |
|---------------|-------------|
| `enable channel:` | Active les notifications dans ce salon. Rôles utilisés : `@🍎・Curious` (articles), `Keepio iOS` et `Keepio Android` |
| `disable` | Désactive les notifications |
| `role type: role:` | Change le rôle mentionné pour les articles, Keepio iOS ou Keepio Android |
| `preview type:` | Affiche la notification du dernier article / de la version iOS ou Android actuelle / l'annonce de lancement, visible par vous seul et sans ping |
| `announce [channel:]` | Poste l'annonce de lancement (avec @here) expliquant les notifications et renvoyant vers Channels & Roles pour prendre `@🍎・Curious`, Keepio iOS et Keepio Android |
| `status` | Affiche la configuration |

**Exemples** :
```
/notif-setup enable channel:#📢・annonces
/notif-setup preview type:Dernier article
```

À l'activation, le dernier article et les versions actuelles de Keepio (iOS et Android) sont mémorisés : seules les publications suivantes sont annoncées.

**Depuis le serveur (sans Discord)** — même logique que `/notif-setup` :
```bash
bun src/scripts/notif-setup-now.ts check [--channel=<id>]   # diagnostic : MongoDB, App Store, Google Play, rôles, permissions
bun src/scripts/notif-setup-now.ts enable --channel=<id>    # activation
bun src/scripts/notif-setup-now.ts announce --yes           # annonce de lancement (@here)
```

---

## 🎨 Guide des Couleurs Recommandées

Palette "Nature Fresh" utilisée par Bob :

```
#2ECC71  Vert Émeraude    → Succès, bienvenue
#27AE60  Vert Sapin       → Confirmation
#1ABC9C  Turquoise        → Informations
#16A085  Sarcelle         → Info secondaire
#F39C12  Orange Terre     → Attention
#E67E22  Orange Carotte   → Warning important
#D35400  Terracotta       → Erreurs
#8E44AD  Violet Aubergine → Événements spéciaux
#2980B9  Bleu Océan       → Informations
#ECF0F1  Blanc Nuage      → Neutre
```

---

## 💡 Astuces et Bonnes Pratiques

### Pour le Système de Bienvenue

**Utiliser les variables** :
```
Titre: Bienvenue {user} sur {server} !
Description: Tu es notre {memberCount}ème membre ! {user.mention}
```

**Tester avant de valider** :
- Utilise `/welcome-view` pour voir la config
- Utilise `/welcome-toggle` pour activer/désactiver temporairement
- Modifie avec `/welcome-edit` plutôt que tout refaire

**Personnalisation** :
- Utilise des emojis dans le titre et la description
- Adapte la couleur à ton thème de serveur
- Ajoute une image pour rendre le message plus visuel

---

## ⚙️ Permissions Requises pour Bob

Bob a besoin de ces permissions pour fonctionner correctement :

**Permissions globales** :
- ✅ Voir les salons
- ✅ Envoyer des messages
- ✅ Intégrer des liens
- ✅ Joindre des fichiers
- ✅ Lire l'historique des messages
- ✅ Utiliser des emojis externes
- ✅ Ajouter des réactions
- ✅ Gérer les salons (pour les salons vocaux temporaires)
- ✅ Gérer les rôles (pour les récompenses de niveaux)
- ✅ Mentionner @everyone, @here et tous les rôles (pour les notifications d'articles et de Keepio)

**Intents activés** :
- ✅ Presence Intent
- ✅ Server Members Intent (crucial pour le système de bienvenue)
- ✅ Message Content Intent

---

## 🆘 Support et Dépannage

### Les commandes n'apparaissent pas
- Attends quelques minutes (Discord peut prendre du temps)
- Vérifie que Bob a la permission "Utiliser les commandes slash"
- Relance `bun run deploy` si nécessaire

### Le système de bienvenue ne fonctionne pas
- Vérifie avec `/welcome-view` que le système est activé
- Assure-toi que le canal existe toujours
- Vérifie que "Server Members Intent" est activé dans le Developer Portal
- Vérifie que Bob a la permission d'envoyer des messages dans le canal

## 📚 Ressources

- **Repository** : `/Users/carolanelefebvre/Developer/bots/discord-bot`
- **Documentation complète** : `README.md`
- **Guide de démarrage** : `QUICKSTART.md`
- **Base de données** : MongoDB Atlas

---

**Version** : 1.0.0
**Dernière mise à jour** : Novembre 2024
**Bot** : Bob
**Développé avec** : TypeScript + Bun + Discord.js + MongoDB
