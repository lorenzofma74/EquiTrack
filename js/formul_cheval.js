/* Script GESTION CHEVAL + API FULLCALENDAR */

// --- 1. CONSTANTES DOM ---
const BTN_SAVE_INFO = document.getElementById('btn-save-info');
const BTN_ADD_EVENT = document.getElementById('btn-add-event');

const INPUT_NOM = document.getElementById('nom-cheval');
const INPUT_RACE = document.getElementById('race-cheval');
const INPUT_AGE = document.getElementById('age-cheval');

const SELECT_TYPE = document.getElementById('type-event');
const INPUT_DATE = document.getElementById('date-event');
const INPUT_DESC = document.getElementById('desc-event');

const LISTE_HISTORY = document.getElementById('liste-historique');
const CALENDAR_EL = document.getElementById('calendar');

// Clés de stockage
const KEY_INFO = 'equitrack_save_info';
const KEY_EVENTS = 'equitrack_save_events';

// Variable globale pour le calendrier
let calendarApi = null;


// --- 2. DEMARRAGE ---
window.addEventListener('load', function() {
    chargerInfoCheval();
    chargerHistorique();
    
    // Initialisation du calendrier API
    initialiserCalendrier();

    // Fix visuel MDL
    setTimeout(fixVisualMdl, 100);
});

function fixVisualMdl() {
    let inputs = document.querySelectorAll('.mdl-textfield__input');
    for (let i = 0; i < inputs.length; i++) {
        let el = inputs[i];
        if ((el.value && el.value.length > 0) || el.type === 'date') {
            el.parentNode.classList.add('is-dirty');
        }
    }
}


// --- 3. CONFIGURATION ET GESTION CALENDRIER (API FULLCALENDAR) ---

function initialiserCalendrier() {
    // Récupération des données pour le calendrier
    let eventsForCalendar = preparerEvenementsPourCalendrier();

    calendarApi = new FullCalendar.Calendar(CALENDAR_EL, {
        initialView: 'dayGridMonth',
        locale: 'fr', // Langue française
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'today' // Bouton pour revenir à aujourd'hui
        },
        height: 400, // Hauteur fixe
        events: eventsForCalendar, // On injecte nos données
        
        // Optionnel : clic sur un événement dans le calendrier
        eventClick: function(info) {
            alert('Détail : ' + info.event.title);
        }
    });

    calendarApi.render();
}

// Convertit tes données "localStorage" en format "FullCalendar"
function preparerEvenementsPourCalendrier() {
    let rawEvents = recupererEvenements();
    let formattedEvents = [];

    for (let i = 0; i < rawEvents.length; i++) {
        let ev = rawEvents[i];
        
        // Couleur selon le type
        let color = '#3788d8'; // Bleu par défaut
        if (ev.type === 'vaccin') color = '#e91e63'; // Rose
        if (ev.type === 'marechal') color = '#795548'; // Marron
        if (ev.type === 'osteo') color = '#9c27b0'; // Violet
        if (ev.type === 'concours') color = '#ff9800'; // Orange
        
        formattedEvents.push({
            id: ev.id,
            title: ev.type.toUpperCase() + (ev.desc ? ' - ' + ev.desc : ''),
            start: ev.date, // Format YYYY-MM-DD accepté par l'API
            backgroundColor: color,
            borderColor: color
        });
    }

    return formattedEvents;
}

// Fonction pour rafraîchir le calendrier après un ajout/suppression
function updateCalendrier() {
    if (calendarApi) {
        // On supprime les anciens et on remet les nouveaux
        calendarApi.removeAllEvents();
        let newEvents = preparerEvenementsPourCalendrier();
        calendarApi.addEventSource(newEvents);
    }
}


// --- 4. GESTION DU PROFIL ---
BTN_SAVE_INFO.addEventListener('click', function() {
    let info = {
        nom: INPUT_NOM.value,
        race: INPUT_RACE.value,
        age: INPUT_AGE.value
    };
    localStorage.setItem(KEY_INFO, JSON.stringify(info));
    alert("Profil sauvegardé !");
});

function chargerInfoCheval() {
    let data = localStorage.getItem(KEY_INFO);
    if (data) {
        let info = JSON.parse(data);
        INPUT_NOM.value = info.nom;
        INPUT_RACE.value = info.race;
        INPUT_AGE.value = info.age;
    }
}


// --- 5. GESTION DES ÉVÉNEMENTS (Formulaire) ---
BTN_ADD_EVENT.addEventListener('click', function() {
    if (INPUT_DATE.value === "") {
        alert("⚠️ Merci de choisir une date.");
        return;
    }

    let nouvelEvent = {
        id: Date.now(),
        type: SELECT_TYPE.value,
        date: INPUT_DATE.value,
        desc: INPUT_DESC.value
    };

    let events = recupererEvenements();
    events.push(nouvelEvent);
    localStorage.setItem(KEY_EVENTS, JSON.stringify(events));

    INPUT_DESC.value = "";
    
    chargerHistorique();
    updateCalendrier(); // Mise à jour automatique du calendrier visuel
    alert("✅ Ajouté !");
});

function recupererEvenements() {
    let data = localStorage.getItem(KEY_EVENTS);
    if (!data) return [];
    return JSON.parse(data);
}

function chargerHistorique() {
    let events = recupererEvenements();
    LISTE_HISTORY.innerHTML = "";

    if (events.length === 0) {
        LISTE_HISTORY.innerHTML = '<li class="mdl-list__item">Aucun historique.</li>';
        return;
    }

    events.sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    for (let i = 0; i < events.length; i++) {
        let ev = events[i];
        let icone = "event";
        
        if (ev.type === "vaccin") icone = "local_hospital";
        else if (ev.type === "marechal") icone = "build";
        else if (ev.type === "osteo") icone = "accessibility";
        else if (ev.type === "cours" || ev.type === "concours") icone = "emoji_events";

        let dateFr = new Date(ev.date).toLocaleDateString('fr-FR');

        let html = 
            '<li class="mdl-list__item mdl-list__item--three-line">' +
                '<span class="mdl-list__item-primary-content">' +
                    '<i class="material-icons mdl-list__item-avatar" style="background-color: #3f51b5;">' + icone + '</i>' +
                    '<span>' + ev.type.toUpperCase() + '</span>' +
                    '<span class="mdl-list__item-text-body">' + dateFr + ' - ' + ev.desc + '</span>' +
                '</span>' +
                '<span class="mdl-list__item-secondary-content">' +
                    '<button class="mdl-button mdl-js-button mdl-button--icon mdl-button--colored" onclick="supprimerEvent(' + ev.id + ')">' +
                        '<i class="material-icons">delete</i>' +
                    '</button>' +
                '</span>' +
            '</li>' +
            '<hr style="margin:0">';
            
        LISTE_HISTORY.innerHTML += html;
    }
}

window.supprimerEvent = function(id) {
    if(confirm("Supprimer ?")) {
        let events = recupererEvenements();
        let reste = [];
        for(let i=0; i<events.length; i++) {
            if(events[i].id !== id) reste.push(events[i]);
        }
        localStorage.setItem(KEY_EVENTS, JSON.stringify(reste));
        
        chargerHistorique();
        updateCalendrier(); // Mise à jour du calendrier
    }
};;;
