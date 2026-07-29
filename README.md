# Sillage

PWA tactile et premium pour contrôler Home Assistant depuis un iPad mural. Elle parle directement au protocole WebSocket de Home Assistant : aucun Lovelace, aucune iframe et aucun serveur intermédiaire.

## Démarrer

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
- `src/features` : onboarding, accueil, températures, chauffage, volets, musique et réglages.
- `src/components`, `src/hooks`, `src/utils`, `src/types` : éléments partagés et types stricts.

Les pages secondaires sont chargées paresseusement. Les états entrants remplacent uniquement l’entité concernée, ce qui évite de reconstruire l’ensemble des données à chaque événement `state_changed`. L’accueil s’abonne entité par entité plutôt qu’à la table complète, et la configuration n’est réécrite dans `localStorage` que lorsqu’elle change réellement : un écran allumé en permanence ne doit pas écrire à chaque événement de la maison.

## Nommage

Les noms de Home Assistant sont rarement présentables sur un mur. **Réglages → Vos noms à vous** permet de renommer n’importe quelle entité ; le nom choisi remplace celui de Home Assistant sur toutes les pages. Un champ vidé revient au nom d’origine, et à défaut de nom l’identifiant est rendu lisible (`cover.volet_baie` → « Volet Baie »). Ces libellés sont locaux à l’appareil et ne modifient jamais Home Assistant.

## Connexion Home Assistant

Dans Home Assistant : **profil utilisateur → Sécurité → Jetons d’accès longue durée → Créer un jeton**. Copiez-le une seule fois et saisissez-le dans l’onboarding avec l’URL de l’instance, par exemple `https://homeassistant.local:8123`.

Sillage transforme automatiquement `https://` en `wss://` (et `http://` en `ws://`) puis utilise `/api/websocket`. Après `auth_ok`, il récupère tous les états, s’abonne à `state_changed` et resynchronise complètement après une reconnexion avec backoff exponentiel.

Un `ping` part toutes les 30 secondes : sans `pong` dans les 10 secondes, la connexion est considérée morte, fermée et rétablie. C’est le seul moyen fiable de détecter une socket à moitié ouverte derrière un reverse proxy, situation où l’écran afficherait sinon des valeurs figées en se croyant connecté.

## Sécurité

Le jeton est conservé dans `localStorage` de ce navigateur afin de permettre une PWA autonome. Il n’est jamais écrit dans les logs, le dépôt ou les diagnostics, et il est masqué pendant la saisie. Cela signifie que toute personne ayant accès au navigateur iPad peut potentiellement contrôler la maison : protégez l’iPad et utilisez un jeton dédié, révocable. Le bouton **Réinitialiser** supprime la configuration locale.

En production, servez obligatoirement l’application en HTTPS et Home Assistant en HTTPS/WSS. Évitez les certificats auto-signés non approuvés par l’iPad, car le navigateur bloquera le WebSocket sécurisé.

## Connexion Spotify

Sillage contrôle Spotify directement depuis le navigateur, via OAuth avec PKCE : il n’y a donc **aucun client secret** à créer, saisir ou publier. Un compte Spotify Premium est nécessaire pour le contrôle de lecture.

1. Ouvrez le [tableau de bord Spotify for Developers](https://developer.spotify.com/dashboard), créez une application puis copiez son **Client ID**.
2. Dans les paramètres de l’application Spotify, ajoutez l’URL de redirection exacte de Sillage, suivie de `/callback` :
   - en local : `http://127.0.0.1:5173/callback` ;
   - en production : `https://votre-domaine.example/callback`.
3. Indiquez le Client ID dans **Réglages → Spotify** de Sillage, ou définissez `VITE_SPOTIFY_CLIENT_ID` dans `.env.local` avant de lancer la construction.
4. Cliquez sur **Connecter mon compte**, acceptez les autorisations Spotify, puis choisissez un appareil de lecture actif (enceinte, téléphone, etc.) dans la page Musique.

Spotify n’accepte pas de redirection HTTP hors de l’adresse de boucle locale. Pour un iPad servi en HTTP sur le réseau local, connectez d’abord le compte depuis `http://127.0.0.1:5173`, puis copiez le **jeton à reporter sur vos autres écrans** affiché dans les Réglages de Sillage et collez-le sur l’iPad. Préférez néanmoins un déploiement HTTPS.

## Mode démo

Le mode démo est intégré, ne contacte aucun service et fournit météo, Tempo, températures, thermostat, volets, Spotify et mises à jour simulés. Les contrôles modifient les données locales pour valider l’expérience sans instance Home Assistant.

## Installation iPad

1. Déployez le contenu de `dist/` sur un hébergement HTTPS (Nginx, Caddy, Netlify, Vercel ou serveur statique Home Assistant).
2. Dans Safari iPad, ouvrez l’URL, puis **Partager → Sur l’écran d’accueil**.
3. Lancez Sillage depuis l’icône : il s’ouvre en mode autonome. Orientez l’iPad en paysage.

Les icônes d’accueil sont des PNG générés depuis `public/icon.svg` (`npx pwa-assets-generator --preset minimal-2023 public/icon.svg`), car iOS refuse le SVG pour l’écran d’accueil. Les polices sont empaquetées avec l’application et précachées : aucune requête vers Google Fonts, donc une typographie intacte sur un réseau isolé.

Le service worker ne met en cache que les fichiers statiques de l’interface ; ni jeton ni état Home Assistant ne sont mis en cache comme données actuelles. Lorsqu’une version est prête, l’application demande discrètement avant de l’activer.

## Déploiement

```bash
npm run build
# publier le dossier dist/ derrière HTTPS, avec une réécriture des routes vers index.html
```

Pour un réseau local, une URL interne peut être saisie. Pour l’accès extérieur, privilégiez un reverse proxy HTTPS fiable et une URL externe. Home Assistant doit autoriser l’origine de l’application si votre configuration de proxy/CORS l’exige.
