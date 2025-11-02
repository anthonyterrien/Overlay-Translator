# Overlay Translator

Une application Electron.js pour créer un overlay de traduction en direct pour OBS, avec intégration Whispering-UI.

## Caractéristiques

- **Overlay transparent** pour OBS avec fond personnalisable
- **Configuration en temps réel** de l'apparence du texte
- **Connexion automatique** à Whispering-UI via WebSocket
- **Interface intuitive** pour gérer tous les paramètres
- **Mise à jour instantanée** de l'overlay lors des changements de configuration

## Structure du projet

```
OverlayTranslator/
├── main.js                    # Process principal Electron
├── preload.js                 # Script de préchargement sécurisé
├── package.json               # Configuration npm
├── config.json               # Configuration sauvegardée
├── src/
│   ├── renderer/
│   │   └── index.html        # Interface principale Electron
│   └── server/
│       └── server.js         # Serveur Express + WebSocket
└── public/
    ├── live.html             # Page overlay pour OBS
    ├── config.html           # Interface de configuration
    ├── client.js             # Logique frontend
    └── style.css             # Styles CSS
```

## Installation

1. Cloner ou télécharger ce projet
2. Installer les dépendances :

```bash
npm install
```

## Lancement

```bash
npm start
```

L'application Electron se lancera et démarrera automatiquement le serveur local sur le port 3000.

## Utilisation

### 1. Interface principale

Lorsque vous lancez l'application avec `npm start`, une fenêtre Electron s'ouvre avec :
- **Panneau gauche** : Configuration complète de l'overlay
- **Panneau droit** : Preview en temps réel avec le flux de traductions

### 2. Configuration de l'overlay

Dans le panneau gauche, vous pouvez personnaliser :
- **Text Styling** :
  - Couleur du texte
  - Taille de la police (12-72px)
  - Famille de police (Arial, Times New Roman, etc.)
  - Alignement du texte (left, center, right)
- **Display Options** :
  - Nombre maximum de lignes (1-10)
  - Padding (0-50px)
  - Activation du défilement
- **Background** :
  - Couleur de fond (utilisez "transparent" pour OBS)

**Boutons** :
- 💾 **Save Configuration** : Sauvegarde et applique immédiatement les changements
- 🔄 **Reset to Default** : Réinitialise la configuration par défaut
- 🪟 **Open Overlay Window** : Ouvre une fenêtre overlay transparente

### 3. Preview en temps réel

Le panneau droit affiche :
- **Live Preview** : Aperçu en direct avec le vrai flux de traductions
- **Connection Status** : Indicateur de connexion WebSocket (vert = connecté)
- Les traductions apparaissent exactement comme dans OBS

### 4. Configuration dans OBS

**Option 1 : Source de navigateur (Recommandé)**
1. Assurez-vous que **Whispering-UI** tourne sur `ws://localhost:5000/translate`
2. Dans OBS, ajoutez une nouvelle **Source de navigateur** (Browser Source)
3. Configurez les paramètres :
   - **URL** : `http://localhost:3000/live`
   - **Largeur** : 1920 (ou votre résolution de stream)
   - **Hauteur** : 1080 (ou votre résolution de stream)
4. Cliquez sur **OK**
5. Positionnez la source dans votre scène

**Option 2 : Capture de fenêtre**
1. Cliquez sur **🪟 Open Overlay Window** dans l'app Electron
2. Dans OBS, ajoutez une **Capture de fenêtre**
3. Sélectionnez "Overlay - OBS Source"
4. La fenêtre est transparente et always-on-top

### 5. Utilisation en direct

Une fois tout configuré :
- Les traductions de Whispering-UI apparaîtront automatiquement dans l'overlay
- Vous pouvez modifier la configuration à tout moment
- Les changements s'appliquent immédiatement à l'overlay dans OBS

## Configuration Whispering-UI

L'application se connecte automatiquement à Whispering-UI sur :
- **WebSocket URL** : `ws://localhost:5000/translate`

Elle filtre les messages JSON avec :
- `type === "processing_data"`
- Extrait le champ `translated` si disponible, sinon `data`

## URLs disponibles

- **Fenêtre principale** : Lancée automatiquement par Electron
- **Overlay OBS** : `http://localhost:3000/live`
- **Configuration** : `http://localhost:3000/config`
- **API Config GET** : `http://localhost:3000/api/config`
- **API Config POST** : `http://localhost:3000/api/config`

## Configuration par défaut

```json
{
  "color": "#FFFFFF",
  "fontSize": "24px",
  "fontFamily": "Arial, sans-serif",
  "textAlign": "left",
  "scrollEnabled": false,
  "backgroundColor": "transparent",
  "padding": "10px",
  "maxLines": 5
}
```

## Personnalisation

### Modifier le port du serveur

Dans `src/server/server.js`, ligne 9 :
```javascript
const PORT = 3000; // Changez cette valeur
```

### Modifier l'URL Whispering-UI

Dans `src/server/server.js`, ligne 11 :
```javascript
const WHISPERING_UI_WS = 'ws://localhost:5000/translate'; // Changez cette valeur
```

## Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 3000 n'est pas déjà utilisé
- Consultez la console Electron pour voir les erreurs

### L'overlay ne reçoit pas de traductions
- Assurez-vous que Whispering-UI est en cours d'exécution
- Vérifiez l'URL WebSocket dans `server.js`
- Consultez la console du navigateur dans OBS (clic droit sur la source > Interagir)

### Les changements de configuration ne s'appliquent pas dans OBS

L'application utilise un système de mise à jour automatique :
1. Quand vous cliquez sur "Save Configuration", le fichier `config.json` est sauvegardé
2. Le serveur détecte le changement du fichier automatiquement (fs.watch)
3. Le serveur recharge la config et la broadcast via WebSocket à tous les clients connectés
4. L'overlay dans OBS reçoit la nouvelle config et se met à jour instantanément

**Si les changements ne s'appliquent toujours pas** :
- Vérifiez que le message "Configuration saved successfully!" apparaît
- Regardez dans le preview de l'app Electron - si ça marche là, le serveur fonctionne
- Dans OBS, vérifiez la console de la source navigateur :
  - Clic droit sur la source > **Interagir**
  - Appuyez sur F12 pour ouvrir les DevTools
  - Regardez les messages WebSocket dans l'onglet Console
  - Vous devriez voir "Connected to overlay server" et les messages de config
- Si aucun message n'apparaît, rafraîchissez la source navigateur (clic droit > Actualiser)

**Pour tester manuellement** :
1. Ouvrez `http://localhost:3000/live` dans votre navigateur web
2. Ouvrez la console (F12)
3. Changez la config dans l'app Electron
4. Vous devriez voir les changements immédiatement dans le navigateur

## Développement

Pour lancer en mode développement avec DevTools ouvert :

```bash
npm run dev
```

## Technologies utilisées

- **Electron** : Framework pour application de bureau
- **Express** : Serveur web
- **WebSocket (ws)** : Communication temps réel
- **CORS** : Gestion des requêtes cross-origin

## Licence

MIT

## Support

Pour toute question ou problème, veuillez ouvrir une issue sur le dépôt du projet.