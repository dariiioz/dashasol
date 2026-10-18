# Courses et calendrier

L’accueil affiche une liste de courses modifiable et les quatre prochains événements des trente jours à venir. L’onglet **Agenda** offre une vue mensuelle, les événements de chaque journée, l’ajout d’événements (horaires ou journée entière, lieu, note), et la liste complète des courses avec articles cochés.

Les sources sont choisies dans chaque vue de l’onglet Agenda. Par défaut, Domoryx privilégie la liste Shopping list et un calendrier permettant la création d’événements. Le calendrier Personnel a été créé dans Home Assistant via l’intégration Local calendar. Les calendriers existants en lecture seule, comme Tempo, restent consultables sans bouton de création.

Les lectures et écritures passent par la connexion WebSocket Home Assistant déjà authentifiée : `todo.get_items`, `todo.add_item`, `todo.update_item`, `todo.remove_item`, `calendar.get_events`, `calendar.create_event`. Les lectures demandent `return_response: true`. Les articles sont cochés par identifiant, même si plusieurs ont le même nom. Les capacités des entités contrôlent les boutons disponibles. Une déconnexion ne déclenche jamais une écriture de secours dans une autre source.

Les changements d’état des listes déclenchent une relecture ; les autres données sont actualisées toutes les minutes et au retour de l’onglet visible. Les dates de fin des événements sur une journée entière sont exclusives, conformément à Home Assistant. Le formulaire affiche un dernier jour inclusif pour l’utilisateur.

L’option **Sur cet appareil** utilise `domoryx-planner-v1` dans le stockage local du navigateur. Elle reste disponible sans Home Assistant, mais ne synchronise pas entre appareils. Les données locales ne sont pas transférées automatiquement lorsqu’une source Home Assistant est choisie. Les événements Home Assistant existants sont consultables ; cette version ne les modifie ni ne les supprime. Les événements locaux peuvent être supprimés.

Vérifications : tests de conversions de dates, doublons d’articles, réponses HA invalides, refus des écritures déconnectées, stockage local et formulaires. Un test réel a validé les opérations de courses et la création/lecture d’un événement dans Home Assistant ; ses éléments temporaires ont été retirés.
