# Énergie, Tempo et recharge

L’onglet Énergie lit les six index `sensor.lixee_easf01` à `06` via les statistiques Recorder de Home Assistant. Les vues couvrent aujourd’hui, les sept derniers jours et le mois courant, selon Europe/Paris. Les statistiques sont actualisées toutes les cinq minutes. Une absence de mesure n’est pas convertie en zéro et un historique incomplet est signalé.

Les tarifs fixes déjà associés aux index dans les préférences Énergie de HA sont importés en lecture seule. Le bouton Tarifs permet de les remplacer dans ce navigateur. Les estimations appliquent les prix renseignés à toute la période sélectionnée, hors abonnement : elles ne constituent pas une facture historique. Aucun tarif EDF n’est codé en dur.

L’accueil utilise les capteurs RTE existants lorsque les anciennes associations Tempo sont absentes ou invalides. Le bandeau Tempo et la puissance ouvrent l’onglet Énergie. La courbe de puissance sur 24 heures reste disponible dans cet onglet.

## Borne Dé

Le service Python collecte la borne toutes les quinze secondes, même si le navigateur est fermé. Il doit rester démarré sur une machine ayant accès à la borne. `npm run dev` démarre ce service ; `npm run vehicle:serve` permet aussi de le lancer séparément.

Les sessions observées sont conservées dans `.vehicle-data/charger-history.json` (permissions 0600, exclu de Git et de la diffusion Vite). Les 365 dernières sessions sont conservées. Aucun ancien historique cloud Tuya n’est importé.

La puissance locale mesurée est intégrée pour estimer les kWh. Les interruptions de plus de 90 secondes et les valeurs manquantes ne sont pas interpolées ; la session devient partielle. Un suivi commencé pendant une recharge est également marqué partiel. Les segments de cinq minutes respectent les limites des plages tarifaires. Les coûts utilisent la couleur RTE enregistrée dans l’historique HA, avec les tarifs renseignés ; si l’historique ou un tarif manque, le coût est indisponible.

La simulation compare une même quantité de kWh au tarif actuel et en heures creuses de la nuit en cours ou à venir. Elle suppose que toute cette énergie est chargée dans la plage choisie. Elle ne programme pas la borne. Le compte Volkswagen et la borne restent en lecture seule ; aucun démarrage, arrêt ou changement d’intensité n’est envoyé.

Les lectures de la borne restent protégées par la session Volkswagen existante. Une session Volkswagen expirée peut masquer les données dans le navigateur sans interrompre la collecte locale.

## Vérification

Tests frontend : calculs des six index, prix manquants, variantes des préférences HA, bornes calendaires et changement d’heure, tarification d’une session traversant 22 h, modification des tarifs et simulation.

Tests Python : unités de la borne, indisponibilité, absence d’interpolation pendant une coupure, démarrage en cours de charge, découpage des segments, pause/reprise et restauration du fichier.
