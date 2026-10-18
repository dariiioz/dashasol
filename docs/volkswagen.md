# ID.4 — connexion dédiée Volkswagen

État des sources vérifié le **18 octobre 2026**. Le connecteur de Domoryx est
implémenté et son parcours de connexion est testé avec des réponses simulées.
L’URL officielle de connexion a répondu HTTP 200 depuis cette machine. **La
récupération effective d’un véhicule n’est validable qu’après la connexion du
propriétaire et la réception de données Volkswagen.** Aucun chiffre de démonstration
n’est présenté comme une donnée de l’ID.4. Un essai réel a atteint le code e-mail, puis une demande de validation du portail Volkswagen, avant la lecture du véhicule.

## Projets examinés

| Projet | État constaté dans sa documentation | Décision |
| --- | --- | --- |
| [WeConnect-python](https://github.com/tillsteinbach/WeConnect-python) | Fin de vie annoncée, remplacé par CarConnectivity | Écarté pour un nouveau connecteur |
| [homeassistant-volkswagencarnet](https://github.com/robinostlund/homeassistant-volkswagencarnet) | README : authentification actuellement bloquée, suivi dans [#989](https://github.com/robinostlund/homeassistant-volkswagencarnet/issues/989) | Écarté comme base de connexion |
| [VW Group Connect](https://github.com/its-me-prash/vwgroup-connect-ha) | Plusieurs canaux, VW Europe via portail EU Data Act ; canal web optionnel | Alternative Home Assistant, non installée |
| [ha-volkswagen-connect v0.5.38](https://github.com/rafaelhutter/ha-volkswagen-connect/releases/tag/v0.5.38) | Version publiée le 15 octobre 2026 ; client web Volkswagen, OTP par e-mail et lectures batterie/recharge | Client MIT adapté pour le service local, sans dépendance Home Assistant |

Ces états sont ceux publiés par les mainteneurs, et ne constituent pas une
validation de tous les comptes Volkswagen. L’API privée peut changer. La voie EU
Data Act est une solution de repli à étudier si le compte refuse le portail web ;
elle n’est pas implémentée dans le service Domoryx actuel.

## Utilisation

1. Ouvrir l’onglet **ID.4**, saisir son e-mail et son mot de passe Volkswagen.
2. Saisir le dernier code reçu par e-mail si Volkswagen le demande.
3. Choisir l’ID.4 si plusieurs véhicules sont présents sur le compte.

Le compte doit être lié au véhicule, avec les services connectés activés et
l’utilisateur principal correctement établi. Si Volkswagen demande une validation
des conditions ou une vérification du compte, le service s’arrête : ouvrir
[myVolkswagen](https://www.volkswagen.de/de/besitzer-und-nutzer/myvolkswagen.html)
et traiter la demande directement sur le site officiel, puis se reconnecter.
Le service n’accepte pas de nouvelles conditions à la place de l’utilisateur. Quand Volkswagen renvoie sa page d’autorisation, Domoryx propose un bouton direct vers cette page officielle et un bouton « J’ai terminé, reprendre la connexion ». Un lien séparé mène au compte Volkswagen France. L’URL d’autorisation est temporaire, contient le contexte de connexion et n’est fournie qu’au navigateur ayant initié la session ; ne la partagez pas.

## Données

Batterie %, autonomie électrique en km, état de recharge, puissance kW, vitesse de
recharge km/h, temps restant en minutes, prise branchée/verrouillée, type AC/DC,
température de batterie, kilométrage, échéance d’inspection et objectif de charge
**uniquement si fournis par les endpoints du portail**. Un champ absent affiche un
tiret. `navigationTargetSOC_pct` n’est pas utilisé comme objectif de charge :
c’est un objectif de navigation, pas nécessairement la limite de recharge.

Les horodatages du véhicule sont distincts de l’heure de consultation du portail.
Un relevé ancien de plus de trente minutes est signalé sur la carte batterie ;
un horodatage absent reste explicitement inconnu. Le kilométrage et la recharge
peuvent porter des dates différentes. Les erreurs réseau conservent le dernier
instantané, avec un message. La voiture endormie peut continuer à fournir un ancien
relevé même si le portail vient d’être consulté.

Le navigateur consulte le service au plus une fois par minute pendant l’affichage,
et le serveur impose **au moins cinq minutes entre deux lectures Volkswagen**,
y compris au clic sur Actualiser. Le service ne réveille pas la voiture. Aucune
commande de recharge, de verrouillage ou de climatisation n’est implémentée.

## Service local

Le navigateur ne peut pas réutiliser directement le portail Volkswagen et ses
cookies inter-domaines. Un petit service Python effectue l’authentification et les
lectures ; Vite lui transmet `/api/vehicle/*` sur la même origine.

Prérequis optionnel pour cette fonction : **Python 3.10+**.

```sh
npm run vehicle:setup
npm run dev
```

Si `python3` est trop ancien, définir `DOMORYX_PYTHON` avec le chemin d’un Python
compatible avant `npm run vehicle:setup`. Le script `dev` lance Vite et le service
véhicule lorsque `.venv-vehicle` existe. On peut aussi lancer le service seul avec
`npm run vehicle:serve`. Il écoute exclusivement sur `127.0.0.1:8766`.

Le mot de passe est retiré de la mémoire du client après la tentative de connexion.
Il n’est ni enregistré sur disque ni mis dans `localStorage`, et aucune reconnexion
avec mot de passe n’est tentée en arrière-plan. La session SSO peut se renouveler
avec ses cookies ; si Volkswagen exige une nouvelle authentification, l’onglet
invite à se reconnecter.

Les cookies Volkswagen et le dernier relevé sont sauvegardés dans
`.vehicle-data/` (dossier `0700`, fichiers `0600`, exclus de Git). Le navigateur ne
reçoit qu’un identifiant de session aléatoire dans un cookie `HttpOnly`,
`SameSite=Strict`, limité à `/api/vehicle` et `Secure` lorsque servi en HTTPS.
Le service impose une vérification d’origine pour les POST et un en-tête dédié ;
il ne fournit pas de CORS et marque toutes les réponses `no-store`. Les secrets
et les réponses brutes du portail ne sont jamais journalisés. La déconnexion
supprime la session et sa sauvegarde locales.

### Production

La fonction voiture nécessite de maintenir le service Python en fonctionnement :
**publier uniquement `dist/` ne suffit plus pour la voiture**. Les autres fonctions
restent utilisables en hébergement statique. Derrière un reverse proxy HTTPS,
conserver la même origine pour l’application et `/api/vehicle`, transmettre le
`Host` d’origine au service et ne pas exposer son port directement.

Exemple Nginx dans le vhost de Domoryx :

```nginx
location /api/vehicle/ {
    proxy_pass http://127.0.0.1:8766;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 180s;
    add_header Cache-Control "no-store" always;
}
```

### Vérifications

```sh
npm test
npm run build
npm run vehicle:test
```

Les tests du service couvrent l’OTP, la session HttpOnly, l’origine des requêtes,
le cache, l’expiration, l’absence de secrets dans les réponses, les permissions
des fichiers et les valeurs indisponibles. Ils ne se connectent à aucun compte réel.
La provenance et les modifications du client sont dans
[`server/vehicle/vendor/NOTICE.md`](../server/vehicle/vendor/NOTICE.md).

## Vue du véhicule

L’écran principal utilise quatre rendus officiels Volkswagen récupérés via VILMA pour le véhicule connecté : avant, profil, arrière et autre côté. Les PNG sont conservés localement dans `public/vehicles/`, sans identifiant du véhicule ni lien signé. Ils remplacent le modèle géométrique générique. Les boutons changent d’angle avec une transition ; il ne s’agit pas d’un modèle 3D interactif.

La batterie, l’autonomie, la prise, la puissance, la durée restante, l’objectif et le kilométrage apparaissent ensemble. Les détails restent accessibles dans les vues Recharge et Détails. Les valeurs absentes restent indiquées par un tiret.

Le halo ambiant respire au repos. Les impulsions de recharge, les particules et le flux de la jauge ne s’activent que si Volkswagen indique `charging`, avec un relevé de moins de trente minutes, une session connectée et aucune erreur. Une puissance positive seule ne déclenche pas ces effets. Les relevés anciens restent datés explicitement. La préférence Réduire les mouvements et celle du système désactivent les animations.

## Borne Dé en local

Le service lit la borne avec TinyTuya 1.20, via son IP privée et le protocole 3.5. La configuration `charger.json` est conservée dans `.vehicle-data/` avec les permissions 0600 ; elle contient `id`, `ip`, `key` et `version`. Aucun secret n’est renvoyé au navigateur. Réserver l’IP de la borne dans le routeur évite un changement d’adresse DHCP.

`GET /api/vehicle/charger` exige la session Volkswagen locale et l’en-tête habituel. Les lectures sont sérialisées et mises en cache 15 secondes. Le navigateur consulte uniquement lorsque la page est visible. Une erreur conserve le dernier relevé et sa date, avec l’indication hors ligne ; les effets de charge s’arrêtent après 45 secondes sans lecture fraîche.

Les DP 109, 150 et 152 suivent le [profil dé maintenu par Tuya Local](https://github.com/make-all/tuya-local/blob/main/custom_components/tuya_local/devices/dewall_evcharger.yaml). Le JSON du DP 102 contient la puissance totale en watts, l’énergie de session en Wh, la température en dixièmes de degré et les tensions/intensités par phase en dixièmes de V/A, selon les [relevés du protocole de cette famille](https://github.com/make-all/tuya-local/issues/5107). L’énergie cumulée et l’historique compact du DP 105 ne sont pas affichés, leurs unités n’étant pas suffisamment établies pour cette version. La consigne en ampères reste distincte de l’intensité mesurée. Seule la méthode `status()` est appelée : aucun démarrage, arrêt, réglage ou commande de rafraîchissement n’est envoyé.

La page ID.4 comporte un raccourci vers la borne et une quatrième vue « Borne Dé ». Les mesures de la borne restent identifiées séparément des relevés Volkswagen. L’état de la borne seul ne prouve pas que le véhicule branché est l’ID.4.
