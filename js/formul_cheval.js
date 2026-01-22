/******************************************************************************/
/* script: formul_cheval.js */
/******************************************************************************/

/* --- ELEMENTS DU DOM (CONSTANTES GLOBALES) --- */
const BOUTON_SAUVEGARDER_INFO = document.getElementById('btn-save-info');
const BOUTON_AJOUTER_EVENT = document.getElementById('btn-add-event');

const ENTREE_NOM = document.getElementById('nom-cheval');
const ENTREE_RACE = document.getElementById('race-cheval');
const ENTREE_AGE = document.getElementById('age-cheval');

const SELECTEUR_TYPE = document.getElementById('type-event');
const ENTREE_DATE = document.getElementById('date-event');
const ENTREE_DESC = document.getElementById('desc-event');

const LISTE_HISTORIQUE = document.getElementById('liste-historique');
const CONTENEUR_CALENDRIER = document.getElementById('calendar');

// Clés pour le stockage local
const CLE_STOCKAGE_INFO = 'equitrack_save_info';
const CLE_STOCKAGE_EVENTS = 'equitrack_save_events';

/* --- VARIABLES D'ETAT (SCOPE GLOBAL) --- */
let instanceCalendrier = null;
let tableauEvenementsCalendrier = [];
let donneesBrutes = [];
let listeEvenements = [];
let objetInfoCheval = {};
let evenementASupprimer = [];

/* --- INITIALISATION & ECOUTEURS --- */

// On attache les fonctions nommées aux événements
window.addEventListener('load', demarrerApplication);

if (BOUTON_SAUVEGARDER_INFO) {
    BOUTON_SAUVEGARDER_INFO.addEventListener('click', gererClicSauvegardeProfil);
}

if (BOUTON_AJOUTER_EVENT) {
    BOUTON_AJOUTER_EVENT.addEventListener('click', gererClicAjoutEvenement);
}

// Nous devons exposer cette fonction globalement pour le onclick="" dans le HTML généré
window.supprimerEvent = actionSupprimerEvenement;

/* --- FONCTIONS DE DÉMARRAGE --- */

// Fonction synchrone : Point d'entrée principal au chargement de la page
// Elle orchestre le chargement des données et l'initialisation des composants
function demarrerApplication() {
    console.log("--- APPLICATION CHEVAL DÉMARRÉE ---");
    chargerProfilCheval();
    genererAffichageHistorique();
    initialiserCalendrier();

    // Petit délai pour corriger l'affichage des champs Material Design
    setTimeout(corrigerAffichageMaterialDesign, 100);
}

// Fonction synchrone : Manipulation pure du DOM pour la librairie MDL
// Nécessaire car MDL ne détecte pas toujours les valeurs pré-remplies
// sert à corriger l'affichage des champs Material Design Lite (MDL) car parfois les labels restent superposés aux champs
function corrigerAffichageMaterialDesign() {
    console.log("Correction visuelle des champs (MDL)...");
    let inputs = document.querySelectorAll('.mdl-textfield__input');

    // Remplacement de forEach par une boucle for classique
    for (let i = 0; i < inputs.length; i++) {
        let el = inputs[i];
        if ((el.value && el.value.length > 0) || el.type === 'date') {
            el.parentNode.classList.add('is-dirty');
        }
    }
}

/* --- GESTION DU CALENDRIER (FULLCALENDAR) --- */

// Fonction synchrone : Instancie la librairie FullCalendar
// Synchrone car l'initialisation est immédiate sur le thread principal
function initialiserCalendrier() {
    console.log("Initialisation du calendrier...");
    tableauEvenementsCalendrier = formaterDonneesPourCalendrier();

    instanceCalendrier = new FullCalendar.Calendar(CONTENEUR_CALENDRIER, {
        initialView: 'dayGridMonth',
        locale: 'fr',
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'today'
        },
        height: 400,
        events: tableauEvenementsCalendrier,

        eventClick: function (info) {
            alert('Détail : ' + info.event.title);
        }
    });

    instanceCalendrier.render();
}

// Fonction synchrone : Transforme les données brutes en format accepté par FullCalendar
function formaterDonneesPourCalendrier() {
    donneesBrutes = recupererListeEvenementsDepuisStockage();
    let evenementsFormates = [];

    for (let i = 0; i < donneesBrutes.length; i++) {
        let ev = donneesBrutes[i];
        let couleur = '#3788d8'; // Bleu par défaut

        // Logique de couleur sans switch/case complexe
        if (ev.type === 'vaccin') couleur = '#e91e63';
        if (ev.type === 'marechal') couleur = '#795548';
        if (ev.type === 'osteo') couleur = '#9c27b0';
        if (ev.type === 'concours') couleur = '#ff9800';

        evenementsFormates.push({
            id: ev.id,
            title: ev.type.toUpperCase() + (ev.desc ? ' - ' + ev.desc : ''),
            start: ev.date,
            backgroundColor: couleur,
            borderColor: couleur
        });
    }

    return evenementsFormates;
}

// Fonction synchrone : Rafraîchit les données du calendrier sans recharger la page
function rafraichirCalendrier() {
    console.log("Mise à jour visuelle du calendrier.");
    if (instanceCalendrier) {
        instanceCalendrier.removeAllEvents();
        let nouveauxEvenements = formaterDonneesPourCalendrier();
        instanceCalendrier.addEventSource(nouveauxEvenements);
    }
}

/* --- GESTION DU PROFIL (INFO CHEVAL) --- */

// Fonction synchrone : Sauvegarde les infos dans le LocalStorage
function gererClicSauvegardeProfil() {
    console.log("Tentative de sauvegarde du profil...");

    objetInfoCheval = {
        nom: ENTREE_NOM.value,
        race: ENTREE_RACE.value,
        age: ENTREE_AGE.value
    };

    localStorage.setItem(CLE_STOCKAGE_INFO, JSON.stringify(objetInfoCheval));
    console.log("Profil sauvegardé :", objetInfoCheval);
    alert("Profil sauvegardé !");
}

// Fonction synchrone : Lit le LocalStorage et remplit les champs
function chargerProfilCheval() {
    console.log("Chargement du profil depuis le stockage...");
    let donneesTexte = localStorage.getItem(CLE_STOCKAGE_INFO);

    if (donneesTexte) {
        objetInfoCheval = JSON.parse(donneesTexte);
        ENTREE_NOM.value = objetInfoCheval.nom;
        ENTREE_RACE.value = objetInfoCheval.race;
        ENTREE_AGE.value = objetInfoCheval.age;
    }
}

/* --- GESTION DES ÉVÉNEMENTS (AJOUT / LISTE) --- */

// Fonction synchrone : Helper pour récupérer le tableau depuis LocalStorage
// Evite la duplication de code pour la lecture des données
function recupererListeEvenementsDepuisStockage() {
    let donneesTexte = localStorage.getItem(CLE_STOCKAGE_EVENTS);
    if (!donneesTexte) return [];
    return JSON.parse(donneesTexte);
}

// Fonction synchrone : Traite le formulaire d'ajout
function gererClicAjoutEvenement() {
    console.log("Clic bouton ajout événement.");

    if (ENTREE_DATE.value === "") {
        console.warn("Date manquante.");
        alert("Merci de choisir une date.");
        return;
    }

    let nouvelEvent = {
        id: Date.now(),
        type: SELECTEUR_TYPE.value,
        date: ENTREE_DATE.value,
        desc: ENTREE_DESC.value
    };

    listeEvenements = recupererListeEvenementsDepuisStockage();
    listeEvenements.push(nouvelEvent);

    localStorage.setItem(CLE_STOCKAGE_EVENTS, JSON.stringify(listeEvenements));
    console.log("Nouvel événement ajouté :", nouvelEvent);

    ENTREE_DESC.value = "";

    // Mise à jour de l'interface
    genererAffichageHistorique();
    rafraichirCalendrier();
    alert("Ajouté !");
}

// Fonction synchrone : Génère le HTML de la liste historique
function genererAffichageHistorique() {
    console.log("Génération de l'historique HTML...");
    listeEvenements = recupererListeEvenementsDepuisStockage();
    LISTE_HISTORIQUE.innerHTML = "";

    if (listeEvenements.length === 0) {
        LISTE_HISTORIQUE.innerHTML = '<li class="mdl-list__item">Aucun historique.</li>';
        return;
    }

    // Tri par date décroissante (fonction de comparaison nommée pas nécessaire ici car simple)
    // Utilisation de function() classique et pas fléchée
    listeEvenements.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
    });


    for (let i = 0; i < listeEvenements.length; i++) {
        let ev = listeEvenements[i];
        let icone = "event"; // defaut
        let dateFr = new Date(ev.date).toLocaleDateString('fr-FR');
        let htmlElement = "";

        // Choix de l'icône
        if (ev.type === "vaccin") icone = "local_hospital";
        else if (ev.type === "marechal") icone = "build";
        else if (ev.type === "osteo") icone = "accessibility";
        else if (ev.type === "cours" || ev.type === "concours") icone = "emoji_events";

        // Construction HTML sans template literals complexes pour la clarté
        htmlElement =
            '<li class="mdl-list__item mdl-list__item--three-line">' +
            '<span class="mdl-list__item-primary-content">' +
            '<i class="material-icons mdl-list__item-avatar" style="background-color: #3f51b5;">' + icone + '</i>' +
            '<span>' + ev.type.toUpperCase() + '</span>' +
            '<span class="mdl-list__item-text-body">' + dateFr + ' - ' + ev.desc + '</span>' +
            '</span>' +
            '<span class="mdl-list__item-secondary-content">' +
            // Appel de la fonction globale exposée
            '<button class="mdl-button mdl-js-button mdl-button--icon mdl-button--colored" onclick="window.supprimerEvent(' + ev.id + ')">' +
            '<i class="material-icons">delete</i>' +
            '</button>' +
            '</span>' +
            '</li>' +
            '<hr style="margin:0">';

        LISTE_HISTORIQUE.innerHTML += htmlElement;
    }
}

// Fonction synchrone : Supprime un événement par son ID
// Cette fonction est appelée via le onclick HTML
function actionSupprimerEvenement(id) {
    console.log("Demande de suppression ID :", id);

    if (confirm("Supprimer cet événement ?")) {
        listeEvenements = recupererListeEvenementsDepuisStockage();
        evenementASupprimer = [];

        for (let i = 0; i < listeEvenements.length; i++) {
            if (listeEvenements[i].id !== id) {
                evenementASupprimer.push(listeEvenements[i]);
            }
        }

        localStorage.setItem(CLE_STOCKAGE_EVENTS, JSON.stringify(evenementASupprimer));
        console.log("Événement supprimé. Mise à jour...");

        genererAffichageHistorique();
        rafraichirCalendrier();
    }
}
