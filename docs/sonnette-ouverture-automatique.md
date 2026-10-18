# Ouverture du direct à la sonnerie

Le composant `DoorbellMonitor` reste monté au niveau de l’application, indépendamment de l’onglet actif. Il lit l’état Eufy toutes les 1,5 seconde lorsque le navigateur est visible et ouvre le lecteur partagé à réception d’un nouvel événement `doorbellPress` de la sonnette sélectionnée.

Le bouton de l’accueil et celui de l’onglet Entrée utilisent le même lecteur : une sonnerie pendant une consultation ne lance pas une seconde connexion vidéo. Le dialogue est rendu directement sous `document.body`, au-dessus des cartes et de leurs contextes d’empilement. Il se ferme avec Échap, le bouton Arrêter, un clic sur le fond, la mise en arrière-plan ou après 75 secondes. La vidéo conserve sa limite serveur d’une minute.

Les événements reçus avant le montage du moniteur, vieux de plus de 20 secondes, concernant un autre appareil ou une simple détection de mouvement ne déclenchent pas le direct. Chaque identifiant est consommé une fois ; les événements rapprochés de moins de trois secondes sont regroupés pour éviter les doublons de transport.

Le 18 octobre 2026, une sonnerie à 16 h 49 était visible dans l’activité du service malgré le refus d’inscription au canal push Eufy. L’absence d’ouverture venait du frontend : l’activité reçue n’était reliée à aucun déclencheur de lecture. La correction ne modifie pas les réglages de la sonnette ni les autorisations du compte Eufy.

La tablette doit garder Domoryx ouvert et visible. Cette fonction ne peut pas réveiller un navigateur fermé ou une tablette en veille. Les tests vérifient le déclenchement depuis un autre onglet, l’absence de lecture des anciens événements, le filtrage des mouvements/appareils, les doublons après fermeture et l’unicité du lecteur.

## Fluidité du direct

Le SDK 0.4.0 construit ses durées d’images à partir de l’arrivée des paquets réseau (`Date.now()` dans la source partagée), ce qui répercute la gigue réseau dans le fichier MP4. Une mesure locale avant correction sur 464 images a relevé 26 durées supérieures à 150 ms, 16 inférieures à 10 ms et une durée maximale de 816 ms. Les 16 fragments arrivaient à des intervalles de 0,86 à 2,55 secondes.

`smoothVideoFragment` répartit régulièrement les durées des images dans chaque fragment vidéo en conservant exactement leur somme, les temps de décodage des fragments, les tailles et données compressées, et toutes les données audio. Cela n’ajoute aucune image et ne réencode pas la vidéo. Les interruptions réelles de plus de deux secondes sur une image et les cadences en dehors de la plage 4–60 images/s sont laissées intactes. Ce traitement vise le format du SDK (horloge vidéo de 90 kHz, piste vidéo 1).

Le lecteur attend trois secondes de données lisibles avant de démarrer. Après une pénurie réelle, la réserve augmente progressivement, jusqu’à six secondes. Les petites discontinuités de muxage sont franchies ; après une coupure, une plage décodable située dans les huit secondes suivantes peut être reprise. Une pause volontaire n’est pas annulée automatiquement. La réserve implique quelques secondes de retard sur la scène filmée.

Les attributs DOM du lecteur exposent uniquement, pour vérification locale, la réserve courante, les reprises après pénurie et les compteurs d’images décodées/perdues. Aucun flux vidéo n’est enregistré par ce diagnostic. La limite de durée et l’arrêt quand la page est masquée restent en vigueur.

Vérification réelle finale : lecture active en 2048 × 1536, 298 images comptabilisées dont 7 perdues, une reprise de réserve, puis lecture maintenue avec 7,18 s d’avance à 25,11 s de lecture (contrôle 35 s après ouverture). La fluidité n’est donc pas parfaite dans toutes les conditions. Les animations de fond sont suspendues et le flou de fond du dialogue est désactivé pendant le direct pour réduire le travail graphique de la tablette. Tests supplémentaires : démarrage avec réserve, événement `waiting` pendant `play()`, reprise après pénurie et respect d’une pause volontaire.
