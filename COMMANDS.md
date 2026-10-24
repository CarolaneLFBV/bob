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

## 🎫 Système de Ticketing

### `/ticket-panel`
**Créer le panneau de tickets avec bouton interactif**

**Permissions requises** : Gérer le serveur

**Options** :
| Option | Type | Requis | Description |
|--------|------|--------|-------------|
| `panel-channel` | Canal | ✅ Oui | Canal où afficher le panneau |
| `category` | Catégorie | ✅ Oui | Catégorie où créer les tickets |
| `support-role` | Rôle | ❌ Non | Rôle à pinger dans les nouveaux tickets |

**Ce qui se passe** :
1. Un panneau avec embed et bouton est créé dans le canal
2. Les utilisateurs cliquent sur "🎫 Créer un Ticket"
3. Un canal privé est créé automatiquement (`ticket-0001`, `ticket-0002`, etc.)
4. Le rôle support est pingé dans le nouveau ticket (si configuré)
5. L'utilisateur peut fermer son ticket avec le bouton "🔒 Fermer le Ticket"

**Fonctionnalités** :
- ✅ Numérotation automatique des tickets
- ✅ Un seul ticket ouvert par utilisateur
- ✅ Permissions automatiques (utilisateur + support + bot)
- ✅ Confirmation avant fermeture
- ✅ Suppression automatique du canal après fermeture

**Exemples** :
```
/ticket-panel
  panel-channel: #🎫・support
  category: Support
  support-role: @Support
```

---

### `/ticket-view`
**Voir la configuration et les statistiques du système de tickets**

**Permissions requises** : Gérer le serveur

**Options** : Aucune

**Affiche** :
- 📍 Canal du panneau
- 📂 Catégorie des tickets
- 👥 Rôle support configuré
- 📊 **Statistiques** :
  - Total de tickets créés
  - Tickets ouverts actuellement 🟢
  - Tickets fermés 🔴
  - Prochain numéro de ticket

**Exemples** :
```
/ticket-view
```

**Exemple de résultat** :
```
🎫 Configuration du Système de Tickets

Canal du Panneau: #🎫・support
Catégorie: Support
Rôle Support: @Support

📊 Statistiques
Total de tickets: 42
Tickets ouverts: 3 🟢
Tickets fermés: 39 🔴
Prochain numéro: #43
```

---

## 📱 Espace Dev Mobile

Commandes dédiées à l'écosystème dev iOS / Android / mobile cross-platform.

### `/appstore`
**Affiche la fiche complète d'une app sur l'App Store**

**Options** :
| Option | Type | Requis | Description |
|--------|------|--------|-------------|
| `nom` | Texte (autocomplétion) | ✅ Oui | Nom de l'app (ex: Spotify, Things 3) |
| `pays` | Choix | ❌ Non | Store régional (fr, us, gb, ca, jp, de) — défaut: France |

L'embed affiche : icône, dev, note (avec nombre d'avis), prix, catégorie, taille, version, iOS minimum, date de sortie, date de mise à jour, classification d'âge, bundle ID, screenshot principal + bouton vers l'App Store.

**Exemple** : `/appstore nom: Bear pays: us`

---

### `/swift-evolution`
**Affiche une Swift Evolution Proposal (SE-XXXX)**

**Options** :
| Option | Type | Requis | Description |
|--------|------|--------|-------------|
| `proposal` | Texte (autocomplétion) | ✅ Oui | Numéro ou titre (ex: 401, SE-0401, "if let shorthand") |

L'embed affiche : titre, statut (Accepté / En review / Implémenté / Rejeté…), version Swift cible, auteur·rices, résumé, bugs trackés + bouton vers la proposal complète sur GitHub.

Le flux JSON officiel est mis en cache 1h pour éviter les appels répétés.

**Exemple** : `/swift-evolution proposal: 401`

---

### `/profil`
**Ton profil dev iOSchool**

Trois sous-commandes pour gérer ton profil et trouver des pairs.

#### `/profil set`
Ouvre un formulaire (modal) à 5 champs :

| Champ | Type | Requis | Exemples acceptés |
|---|---|---|---|
| Niveau | Texte | ✅ | apprenti, junior, confirmé, senior |
| Techno principale | Texte | ✅ | SwiftUI, UIKit, mixte, autre |
| Projet en cours | Paragraphe | ❌ | Texte libre (500 car. max) |
| Je cherche | Texte | ✅ | mentor, mentee, binôme, contrats, discuter |
| Bio courte | Paragraphe | ❌ | Texte libre (800 car. max) |

Les valeurs des champs *Niveau*, *Techno* et *Je cherche* sont normalisées : peu importe la casse ou les accents, le bot reconnaît la valeur la plus proche.

#### `/profil voir [membre]`
Affiche le profil de quelqu'un (par défaut: toi).

#### `/profil rechercher [niveau] [techno] [cherche]`
Trouve des pairs qui matchent. Tous les filtres sont optionnels et combinables.

**Exemple** :
```
/profil rechercher techno: SwiftUI cherche: Un·e binôme
→ liste tous les devs SwiftUI qui cherchent un binôme
```

---

### 🍎 Welcome DM iOSchool

Lorsqu'un membre obtient le rôle **iOSchool** via l'onboarding natif Discord, le bot lui envoie automatiquement un **DM privé** de bienvenue contenant :

- Un embed personnalisé avec son avatar
- Un bouton **"Compléter mon profil dev"** qui ouvre directement le modal `/profil set` (fonctionne aussi en DM grâce au `guildId` encodé dans l'interaction)
- Un bouton **"Voir les commandes dev"** qui détaille les 4 commandes de l'Espace Dev Mobile
- Un bouton lien **"Site & blog"** vers `carolanelefebvre.com`

Si le membre a fermé ses DMs, l'envoi échoue silencieusement (loggé en warning). Le rôle est tout de même attribué normalement par Discord.

L'ID du rôle iOSchool est configurable dans `src/config/ioschool.ts` (constante `IOSCHOOL_ROLE_ID`).

---

### `/snippet`
**Bibliothèque communautaire de snippets de code**

Quatre sous-commandes :

#### `/snippet save`
Ouvre un formulaire (modal) pour sauvegarder un snippet — titre, langage, code. Le snippet reçoit un numéro auto-incrémenté (`#0001`, `#0002`…) et est visible par tous les membres du serveur.

#### `/snippet get <numero>`
Affiche un snippet existant. Le numéro a une autocomplétion qui propose les snippets récents ou correspondant à ta saisie. Incrémente le compteur de vues.

#### `/snippet list [langage]`
Liste les 15 snippets les plus récents, optionnellement filtrés par langage (Swift, Kotlin, Dart, TypeScript, JavaScript, Objective-C, Java, Python, JSON, YAML, Shell).

#### `/snippet delete <numero>`
Supprime un de tes propres snippets (seul l'auteur peut supprimer). Demande confirmation.

**Exemple** :
```
/snippet save
  → Modal s'ouvre →
    Titre   : SwiftUI: TextField avec validation live
    Langage : swift
    Code    : <colle ton code>
```

---

## 📰 Notifications Articles & Keepio

Bob annonce automatiquement dans le salon des annonces, avec `@here` :
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
#1ABC9C  Turquoise        → Tickets, info
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

### Pour le Système de Ticketing

**Organisation** :
- Crée une catégorie dédiée aux tickets
- Configure un rôle support spécifique
- Place le panneau dans un canal visible

**Gestion** :
- Utilise `/ticket-view` pour suivre les statistiques
- Vérifie régulièrement les tickets ouverts
- Encourage la fermeture des tickets résolus

**Permissions** :
- Le bot a besoin de "Gérer les canaux"
- Le rôle support doit pouvoir voir les tickets
- Les utilisateurs ne peuvent créer qu'un ticket à la fois

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
- ✅ Gérer les salons (pour les tickets)
- ✅ Gérer les rôles (pour les permissions de tickets)
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

### Les tickets ne se créent pas
- Vérifie avec `/ticket-view` la configuration
- Assure-toi que la catégorie existe
- Vérifie que Bob a "Gérer les canaux"
- Vérifie que l'utilisateur n'a pas déjà un ticket ouvert

---

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
