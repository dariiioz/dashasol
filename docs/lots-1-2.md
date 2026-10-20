# Domoryx 0.2.0 — Lots 1 et 2

## Confiance et maintenance

- Les six commandes du drawer Volets sont configurables dans Réglages → Équipements → Électricité et commandes rapides. Un choix explicite est prioritaire ; s’il disparaît, la commande est désactivée au lieu de cibler un autre script. La page Volets et les commandes proposées à l’assistant utilisent cette résolution commune.
- Le renommage inclut correctement les personnes associées et les commandes configurées, sans ligne « Inconnu » supplémentaire.
- Réglages → Connexions permet de remplacer l’adresse ou le jeton HA. La nouvelle connexion est testée avant enregistrement ; les noms, sélections, préférences et données du planning sont conservés. Annuler abandonne le test.
- La borne est consultable indépendamment du compte Volkswagen, dans Énergie et via son drawer dans ID.4. Les lectures locales ne déclenchent aucune commande de recharge.
- La page Volkswagen distingue une indisponibilité du service local d’une erreur du portail ou d’un compte déconnecté. Le formulaire de connexion n’est pas présenté quand le service local est absent.
- L’environnement véhicule s’installe et se lance avec les mêmes commandes sous Windows et Linux. Les tests de permissions utilisent un contrôle adapté à l’OS.
- La CI couvre installation, tests frontend, compilation et tests des deux services sur Windows et Linux.

## Écran mural et utilisation

- Cinq accès principaux : Accueil, Maison, deux favoris et Plus. Les deux favoris se choisissent dans Réglages → Écran. Chaque page reste accessible en deux gestes au maximum depuis cette navigation.
- Le bouton de personnalisation de l’accueil permet de masquer les cartes, de réordonner la colonne et de choisir Confort ou Compact. Le calendrier conserve sa zone dédiée sur tablette. Les réglages sont conservés après rechargement.
- En automatique, Spotify et Volkswagen non connectés deviennent des raccourcis de connexion. Il reste possible de forcer leur carte en grand.
- Sur téléphone, l’accueil défile verticalement ; la navigation principale reste entièrement visible.
- Les confirmations globales, la réinitialisation et la mise à jour de l’application utilisent un panneau intégré avec Annuler sélectionné initialement. Une confirmation devenue périmée n’envoie pas sa commande.
- Réglages → Connexions affiche les états distincts de HA, météo, Spotify, Eufy, Volkswagen et borne.
- Réglages → Écran permet de maintenir l’écran éveillé si le navigateur l’autorise, et d’atténuer l’affichage la nuit. Le maintien est redemandé au retour au premier plan. L’atténuation ne modifie pas la luminosité matérielle ; elle peut être suspendue dix minutes depuis l’interface.
- Les vues Eufy partagent leur état et leurs lectures : au plus une consultation toutes les trois secondes quand la sonnette est connectée, toutes les trente secondes sans compte, avec ralentissement sur erreur. Les lectures s’arrêtent quand l’application est masquée.
- La carte Personnes ne se réaffiche plus pour chaque changement d’une entité sans rapport.
- Les quatre images de voiture passent d’environ 6 Mio à 185 Kio au total en WebP. Les originaux restent disponibles, mais sont exclus du précache de l’application.

## Installation et accès

```sh
npm install
npm run vehicle:setup
npm run dev
```

`npm run dev` lance les services disponibles avec l’application. Si le serveur de développement était déjà actif pendant l’installation du service véhicule, lancer celui-ci avec `npm run vehicle:serve` ou relancer le développement.

Pour l’iPad, utiliser un hébergement HTTPS et exposer `/api/vehicle` et `/api/eufy` derrière le même reverse proxy que l’interface, en conservant le Host d’origine. Les services restent liés à l’interface locale de la machine. Le reverse proxy doit limiter l’accès aux utilisateurs/appareils de confiance, notamment pour la télémétrie locale de la borne. Voir les documents [Volkswagen](volkswagen.md) et [Eufy](eufy.md).

La connexion aux comptes Spotify et Volkswagen reste à réaliser avec les comptes du foyer si nécessaire. Aucun identifiant n’est inventé ou transféré pendant l’installation.

## Vérification

```sh
npm test
npm run build
npm run eufy:test
npm run vehicle:test
```

Des tests spécifiques couvrent la priorité des commandes, les cibles disparues, la conservation de la configuration HA, l’annulation d’un test de connexion, la personnalisation, la navigation, les confirmations, la mutualisation Eufy et le cycle du maintien d’écran.

Validation locale : 187 tests frontend sur 49 fichiers, 17 tests véhicule et 5 tests Eufy ; compilation réussie. Le précache de production est d’environ 1,1 Mio. Les parcours de personnalisation et de navigation ont été vérifiés en navigateur aux formats 1024 × 768, 768 × 1024 et 375 × 812, y compris le défilement sans chevauchement et le cas où toutes les cartes sont affichées.

Le Wake Lock, la reprise après une nuit de veille et la mise à jour de la PWA doivent aussi être vérifiés sur l’iPad physique et sa version d’iPadOS. Le lot 3 — alertes, repas, tâches et notes familiales — reste distinct.

## Sauvegarde du travail

Des instantanés Git locaux conservent l’état avant et après ces lots dans `refs/codex/checkpoints/`. Ils comprennent les fichiers source non ignorés sans changer la branche de travail. Les fichiers ignorés de configuration et les identifiants ne sont pas ajoutés aux instantanés. Aucune publication distante n’est déclenchée par cette sauvegarde.
