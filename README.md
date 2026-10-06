# Domoryx

PWA tactile et premium pour contrôler Home Assistant depuis un iPad mural. Elle parle directement au protocole WebSocket de Home Assistant : aucun Lovelace, aucune iframe et aucun serveur intermédiaire.

## Démarrer

Prérequis : Node.js 20.19 ou ultérieur (Node.js 24 recommandé).

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée par Vite, puis choisir **Explorer la démo** ou saisir l’URL et le jeton Home Assistant. Pour vérifier le projet :

```bash
npm test
npm run build
```

## Architecture

- `src/services/home-assistant` : protocole WebSocket, authentification, synchronisation, événements et normalisation.
- `src/stores` : configuration versionnée et état léger Zustand.
- `src/services/assistant` : instantané de la maison, outils autorisés et dictée vocale de l’assistant.
- `src/services/openrouter` : appel des modèles OpenRouter avec appels d’outils.
- `src/features` : onboarding, accueil, assistant vocal, températures, chauffage, volets, musique et réglages.
- `src/components`, `src/hooks`, `src/utils`, `src/types` : éléments partagés et types stricts.

Les pages secondaires sont chargées paresseusement. Les états entrants remplacent uniquement l’entité concernée, ce qui évite de reconstruire l’ensemble des données à chaque événement `state_changed`. L’accueil s’abonne entité par entité plutôt qu’à la table complète, et la configuration n’est réécrite dans `localStorage` que lorsqu’elle change réellement : un écran allumé en permanence ne doit pas écrire à chaque événement de la maison.

L’accueil résume uniquement les équipements sélectionnés, y compris les mises à jour. Les commandes sont désactivées hors connexion et sur les équipements indisponibles ; un bandeau rappelle que les valeurs peuvent être anciennes. Une commande sans confirmation de Home Assistant expire après 15 secondes. Les curseurs de chauffage et de volets envoient leur valeur au relâchement tactile ou clavier et évitent les envois doublés lors de la perte du focus.

## Nommage

Les noms de Home Assistant sont rarement présentables sur un mur. **Réglages → Vos noms à vous** permet de renommer n’importe quelle entité ; le nom choisi remplace celui de Home Assistant sur toutes les pages. Un champ vidé revient au nom d’origine, et à défaut de nom l’identifiant est rendu lisible (`cover.volet_baie` → « Volet Baie »). Ces libellés sont locaux à l’appareil et ne modifient jamais Home Assistant.

## Connexion Home Assistant

Dans Home Assistant : **profil utilisateur → Sécurité → Jetons d’accès longue durée → Créer un jeton**. Copiez-le une seule fois et saisissez-le dans l’onboarding avec l’URL de l’instance, par exemple `https://homeassistant.local:8123`.

Domoryx transforme automatiquement `https://` en `wss://` (et `http://` en `ws://`) puis utilise `/api/websocket`. Après `auth_ok`, il récupère tous les états, s’abonne à `state_changed` et resynchronise complètement après une reconnexion avec backoff exponentiel.

Un `ping` part toutes les 30 secondes : sans `pong` dans les 10 secondes, la connexion est considérée morte, fermée et rétablie. C’est le seul moyen fiable de détecter une socket à moitié ouverte derrière un reverse proxy, situation où l’écran afficherait sinon des valeurs figées en se croyant connecté.

## Sécurité

Le jeton est conservé dans `localStorage` de ce navigateur afin de permettre une PWA autonome. Il n’est jamais écrit dans les logs, le dépôt ou les diagnostics, et il est masqué pendant la saisie. Cela signifie que toute personne ayant accès au navigateur iPad peut potentiellement contrôler la maison : protégez l’iPad et utilisez un jeton dédié, révocable. Le bouton **Réinitialiser** supprime la configuration locale.

En production, servez obligatoirement l’application en HTTPS et Home Assistant en HTTPS/WSS. Évitez les certificats auto-signés non approuvés par l’iPad, car le navigateur bloquera le WebSocket sécurisé.

## Connexion Spotify

Domoryx contrôle Spotify directement depuis le navigateur, via OAuth avec PKCE : il n’y a donc **aucun client secret** à créer, saisir ou publier. Un compte Spotify Premium est nécessaire pour le contrôle de lecture.

1. Ouvrez le [tableau de bord Spotify for Developers](https://developer.spotify.com/dashboard), créez une application puis copiez son **Client ID**.
2. Dans les paramètres de l’application Spotify, ajoutez l’URL de redirection exacte de Domoryx, suivie de `/callback` :
   - en local : `http://127.0.0.1:5173/callback` ;
   - en production : `https://votre-domaine.example/callback`.
3. Indiquez le Client ID dans **Réglages → Spotify** de Domoryx, ou définissez `VITE_SPOTIFY_CLIENT_ID` dans `.env.local` avant de lancer la construction.
4. Cliquez sur **Connecter mon compte**, acceptez les autorisations Spotify, puis choisissez un appareil de lecture actif (enceinte, téléphone, etc.) dans la page Musique.

Spotify n’accepte pas de redirection HTTP hors de l’adresse de boucle locale. Pour un iPad servi en HTTP sur le réseau local, connectez d’abord le compte depuis `http://127.0.0.1:5173`, puis copiez le **jeton à reporter sur vos autres écrans** affiché dans les Réglages de Domoryx et collez-le sur l’iPad. Préférez néanmoins un déploiement HTTPS.

## Assistant vocal

L’écran d’accueil porte un bouton **Assistant vocal** : on parle, la maison répond et agit. La dictée et la lecture à voix haute utilisent la reconnaissance vocale du navigateur ; la compréhension passe par [OpenRouter](https://openrouter.ai), avec le modèle **DeepSeek** de votre choix (`deepseek/deepseek-chat` par défaut, modifiable dans les Réglages).

1. Créez une clé sur [openrouter.ai/keys](https://openrouter.ai/keys).
2. Collez-la dans **Réglages → OpenRouter**, ajustez le modèle si besoin, puis **Tester le modèle** pour vérifier la paire clé/modèle par un vrai aller-retour.
3. Sur l’accueil, touchez **Assistant vocal**, parlez, puis touchez à nouveau le micro pour envoyer. Un champ de saisie reste disponible pour les navigateurs sans dictée.

L’assistant ne voit que les équipements sélectionnés dans **Réglages → Équipements affichés**, sous les noms que vous leur avez donnés, plus la météo et l’heure. Il peut régler une consigne de chauffage, changer un mode, positionner un volet, piloter la lecture d’une enceinte et déclencher vos commandes rapides. Tout identifiant qu’il inventerait est refusé avant d’atteindre Home Assistant, et une consigne de température est ramenée entre 7 et 30 °C : le modèle propose, Domoryx dispose.

La clé OpenRouter est un secret, contrairement au Client ID Spotify. Elle vit dans le `localStorage` de cet appareil, n’est envoyée qu’à OpenRouter et n’apparaît ni dans les logs ni dans le dépôt. Chaque question transmet l’état des équipements affichés : c’est ce qui permet de répondre « il fait 19 degrés dans la chambre », et cela sort de votre réseau. En mode démo, l’assistant raisonne sur la maison simulée et n’envoie aucune commande.

Le micro exige un contexte sécurisé, c’est-à-dire HTTPS **ou** la boucle locale. En développement sur `http://localhost:5173` et `http://127.0.0.1:5173` la dictée fonctionne donc normalement ; c’est l’adresse réseau du serveur Vite (`http://192.168.x.x:5173`), celle par laquelle l’iPad accède à la machine, qui est refusée par le navigateur. Domoryx détecte le cas, désactive le micro et l’explique plutôt que de laisser croire à un refus de permission. Pour dicter depuis l’iPad, servez l’application en HTTPS.

Firefox n’implémente pas la reconnaissance vocale : la saisie écrite y reste le seul chemin. Chrome, Edge et Safari envoient l’audio à un service en ligne pour le transcrire — une maison coupée d’Internet garde ses volets, pas sa dictée.

Le cadran de l’assistant réagit aux mots que la reconnaissance renvoie, et non à un second flux micro : deux captations simultanées se disputent la même entrée, et la dictée revient vide pendant que le cadran, lui, danse. Une visualisation ne doit jamais prendre le micro à la fonction qu’elle illustre. La synthèse vocale exige elle aussi une interaction préalable, ce que le geste sur le micro fournit.

## Consommation électrique et historiques

Dans **Réglages → Équipements affichés → Consommation électrique instantanée**, choisissez le capteur de puissance totale de la maison. L’accueil affiche sa valeur en W ou kW et sa fraîcheur. Les capteurs d’énergie cumulée en kWh et de puissance apparente en VA ne sont pas proposés. Une puissance négative est affichée comme une injection sur le réseau.

Un clic sur la carte **Électricité** ouvre l’historique de puissance sur **24 h**, avec la valeur actuelle, les minimums et maximums et un bouton d’actualisation. La courbe utilise les mesures du capteur sélectionné et adapte les unités W/kW.

La page **Températures** affiche les courbes des capteurs sélectionnés sur **6 h**, **24 h** ou **7 jours**, avec leurs minimums et maximums. Les données proviennent de `history/history_during_period` sur la connexion WebSocket existante, sans serveur intermédiaire. L’intégration History et le Recorder de Home Assistant doivent enregistrer les capteurs concernés ; une absence d’historique est affichée explicitement. Les états indisponibles interrompent la courbe. Les historiques sont actualisés toutes les cinq minutes pendant la consultation et peuvent être rafraîchis manuellement. Ils restent en mémoire, sans écriture dans le stockage local.

Le mode démo fournit une puissance variable et des courbes simulées, identifiées comme telles.

## Mode démo

Le mode démo est intégré, ne contacte aucun service et fournit météo, Tempo, températures, thermostat, volets, Spotify et mises à jour simulés. Les contrôles modifient les données locales pour valider l’expérience sans instance Home Assistant.

## Installation iPad

1. Déployez le contenu de `dist/` sur un hébergement HTTPS (Nginx, Caddy, Netlify, Vercel ou serveur statique Home Assistant).
2. Dans Safari iPad, ouvrez l’URL, puis **Partager → Sur l’écran d’accueil**.
3. Lancez Domoryx depuis l’icône : il s’ouvre en mode autonome. Orientez l’iPad en paysage.

Les icônes d’accueil sont des PNG générés depuis `public/icon.svg` (`npx pwa-assets-generator --preset minimal-2023 public/icon.svg`), car iOS refuse le SVG pour l’écran d’accueil. Les polices sont empaquetées avec l’application et précachées : aucune requête vers Google Fonts, donc une typographie intacte sur un réseau isolé.

Le service worker ne met en cache que les fichiers statiques de l’interface ; ni jeton ni état Home Assistant ne sont mis en cache comme données actuelles. Lorsqu’une version est prête, l’application demande discrètement avant de l’activer.

## Déploiement

```bash
npm run build
# publier le dossier dist/ derrière HTTPS, avec une réécriture des routes vers index.html
```

Pour un réseau local, une URL interne peut être saisie. Pour l’accès extérieur, privilégiez un reverse proxy HTTPS fiable et une URL externe. Home Assistant doit autoriser l’origine de l’application si votre configuration de proxy/CORS l’exige.
