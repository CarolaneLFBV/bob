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
