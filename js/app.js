/******************************************************************************/
/* script: app.js */
/******************************************************************************/




/* --- CONSTANTES --- */
const URL_API_EXERCICES = "https://api-equitrack.onrender.com/exercices";
const URL_BASE_METEO = "https://api.open-meteo.com/v1/forecast";
const SEUIL_DETECTION_CHUTE = 50;

const ELEMENT_STATUT_CARTE = document.getElementById("status-map");
const ELEMENT_LIEN_CARTE = document.getElementById("map-link");
const BOUTON_SON = document.getElementById("soundButton");
const AUDIO_CLIC = document.getElementById("clickSound");
const BOUTON_RAFRAICHIR = document.getElementById("btn-refresh-exercices");
const BOUTON_SOS = document.getElementById("btn-start");
const CHAMP_TELEPHONE = document.getElementById("tel-urgence");
const ELEMENT_STATUT_SOS = document.getElementById("status-sos");
const ELEMENT_DEBUG_FORCE = document.getElementById("debug-force");
const CORPS_PAGE = document.getElementById("body-page");
const CONTENEUR_LISTE_EXO = document.getElementById('liste-exercices');
const AFFICHAGE_TEMP = document.getElementById("temperature");
const AFFICHAGE_PLUIE = document.getElementById("rain");
const AFFICHAGE_PREVISIONS = document.getElementById("day-forecast");

/* --- ETAT DE L'APPLICATION (GLOBAL) --- */
let latitude = null;
let longitude = null;
let carteLeaflet = null;
let marqueurCarte = null;
let meteoEstChargee = false;
let surveillanceActive = false;
let vecteurAcceleration = null;
let forceCalculee = 0;

/* --- INITIALISATION & ECOUTEURS D'EVENEMENTS --- */

// On attache les fonctions nommées aux événements
window.addEventListener("load", initialiserApplication);

if (BOUTON_RAFRAICHIR) {
    BOUTON_RAFRAICHIR.addEventListener("click", gererClicRafraichir); // Bouton de rafraîchissement des exercices
}

if (BOUTON_SON) {
    BOUTON_SON.addEventListener("click", gererClicSon); // Bouton sonore
}

if (BOUTON_SOS) {
    BOUTON_SOS.addEventListener("click", demarrerSystemeSOS); // Bouton SOS
}

// Fonction synchrone
// Raison : Point d'entrée qui lance les processus initiaux sans attendre de résultat bloquant
function initialiserApplication() {
    console.log("--- DÉMARRAGE DE L'APPLICATION ---");
    initialiserGeolocalisation();
    chargerExercices();
}

// Fonction synchrone
// Raison : Simple déclencheur d'événement clic
function gererClicRafraichir() {
    console.log("Action utilisateur : Clic sur 'Rafraîchir exercices'");
    chargerExercices();
}

// Fonction synchrone
// Raison : Gestion multimédia locale (audio HTML5) instantanée
function gererClicSon() {
    console.log("Action utilisateur : Clic sur 'Son'");
    AUDIO_CLIC.currentTime = 0;
    AUDIO_CLIC.play();
}

/* --- LOCAL STORAGE --- */

// Fonction synchrone
// Raison : L'écriture dans le localStorage est une opération synchrone du navigateur
function sauvegarderPositionCache(lat, lon) {
    let paquetDonnees = { lat: lat, lon: lon };
    localStorage.setItem("dernierePositionConnue", JSON.stringify(paquetDonnees)); // Sauvegarde en JSON
    console.log("Sauvegarde dans le cache local effectuée :", paquetDonnees);
}

// Fonction synchrone
// Raison : La lecture du localStorage est immédiate
function lirePositionCache() {
    let chaineDonnees = localStorage.getItem("dernierePositionConnue"); // Récupération de la chaîne JSON
    if (chaineDonnees) {
        console.log("Données trouvées dans le cache local.");
        return JSON.parse(chaineDonnees); // Conversion en objet JavaScript
    }
    console.log("Cache local vide.");
    return null;
}

/* --- GÉOLOCALISATION --- */

// Fonction synchrone
// Raison : Démarre le "watcher" GPS. Les résultats arrivent plus tard via callback, mais le démarrage est immédiat.
function initialiserGeolocalisation() {
    console.log("Lancement du module Géolocalisation...");

    ELEMENT_LIEN_CARTE.href = "";
    ELEMENT_LIEN_CARTE.textContent = "";

    if (ELEMENT_STATUT_CARTE) ELEMENT_STATUT_CARTE.textContent = "Recherche satellites...";

    if (!navigator.geolocation) {
        console.error("Erreur critique : L'API Geolocation n'est pas disponible sur ce navigateur.");
        if (ELEMENT_STATUT_CARTE) ELEMENT_STATUT_CARTE.textContent = "Erreur : GPS non supporté.";
        return; // Arrêt si non supporté
    }

    // Appel de l'API native avec des fonctions nommées pour les callbacks
    navigator.geolocation.watchPosition(surReceptionPosition, surErreurPosition, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    });
}

// Fonction asynchrone
// Raison : Contient 'await' pour appeler la fonction météo (qui fait une requête réseau)
async function surReceptionPosition(position) {
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;

    console.log("Position GPS reçue : Lat=" + latitude + ", Lon=" + longitude);
    sauvegarderPositionCache(latitude, longitude);

    if (ELEMENT_STATUT_CARTE) ELEMENT_STATUT_CARTE.textContent = "";
    ELEMENT_LIEN_CARTE.textContent = "Lat : " + latitude.toFixed(4) + " | Lon : " + longitude.toFixed(4); // Affichage arrondi

    mettreAJourCarte(latitude, longitude);

    // Chargement unique de la météo
    if (!meteoEstChargee) {
        console.log("Première position acquise -> Lancement de la requête météo...");
        await recupererMeteo(latitude, longitude);
        meteoEstChargee = true;
    }
}

// Fonction asynchrone
// Raison : Contient 'await' pour appeler la fonction météo en cas d'erreur GPS
async function surErreurPosition(erreur) {
    console.warn("Erreur signal GPS :", erreur.message);

    if (latitude === null) {
        console.log("Tentative de bascule sur le cache local...");
        let donneesCache = lirePositionCache();

        if (donneesCache) {
            console.log("Utilisation des coordonnées du cache :", donneesCache);
            if (ELEMENT_STATUT_CARTE) ELEMENT_STATUT_CARTE.textContent = "Mode Hors Ligne (Cache)";
            mettreAJourCarte(donneesCache.lat, donneesCache.lon);

            if (!meteoEstChargee) {
                console.log("Lancement météo depuis coordonnées cache...");
                await recupererMeteo(donneesCache.lat, donneesCache.lon);
                meteoEstChargee = true;
            }
        } else {
            console.log("Échec : Aucun cache disponible.");
            if (ELEMENT_STATUT_CARTE) ELEMENT_STATUT_CARTE.textContent = "Position indisponible.";
        }
    }
}

// Fonction synchrone
// Raison : Manipulation purement graphique de la librairie Leaflet
function mettreAJourCarte(lat, lon) {
    if (carteLeaflet === null) {
        console.log("Initialisation de la carte Leaflet (première fois).");
        carteLeaflet = L.map("map").setView([lat, lon], 15); // 15 = niveau de zoom

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(carteLeaflet);

        marqueurCarte = L.marker([lat, lon]).addTo(carteLeaflet)
            .bindPopup("Vous êtes ici").openPopup();
    } else {
        // Mise à jour de la vue sans recréer la carte
        marqueurCarte.setLatLng([lat, lon]);
        carteLeaflet.setView([lat, lon]);
    }
}

/* --- MÉTÉO --- */

// Fonction asynchrone
// Raison : Utilise 'fetch' pour une requête réseau vers l'API Open-Meteo. Doit attendre la réponse.
async function recupererMeteo(lat, lon) {
    console.log("Appel API Météo pour : Lat=" + lat + ", Lon=" + lon);

    // Utilisation de variables 'let' uniquement
    let url = URL_BASE_METEO +
        "?latitude=" + lat +
        "&longitude=" + lon +
        "&current_weather=true&hourly=temperature_2m,precipitation_probability&forecast_days=1&models=best_match";

    try {
        let reponse = await fetch(url);

        if (!reponse.ok) {
            throw new Error("Erreur HTTP Météo : " + reponse.status);
        }

        let donneesJson = await reponse.json();
        console.log("Réponse API Météo reçue (JSON complet) :", donneesJson);

        localStorage.setItem("cacheMeteoDonnees", JSON.stringify(donneesJson));
        afficherDonneesMeteo(donneesJson);

    } catch (erreur) {
        console.error("Échec de la récupération météo :", erreur);
        chargerMeteoCache();
    }
}

// Fonction synchrone
// Raison : Lecture de secours depuis le stockage local
function chargerMeteoCache() {
    console.log("Passage en mode météo dégradé (Cache).");
    let cache = localStorage.getItem("cacheMeteoDonnees");

    if (cache) {
        let donnees = JSON.parse(cache);
        console.log("Données météo lues depuis le cache.");
        afficherDonneesMeteo(donnees);
        AFFICHAGE_PREVISIONS.innerHTML += " <br><span style='color:red; font-size:0.8em'>(Mode Hors Ligne)</span>";
    } else {
        console.log("Aucun cache météo disponible.");
    }
}

// Fonction synchrone
// Raison : Mise à jour du DOM
function afficherDonneesMeteo(donnees) {
    let temperatureActuelle = donnees.current_weather.temperature;
    let heureCourante = new Date().getHours();
    let probabilitePluie = donnees.hourly.precipitation_probability[heureCourante];
    let tableauTemperatures = donnees.hourly.temperature_2m;
    let minTemp = 100;
    let maxTemp = -100;

    // boucle qui permet de trouver les valeurs min et max
    for (let i = 0; i < tableauTemperatures.length; i++) {
        let valeur = tableauTemperatures[i];
        if (valeur < minTemp) minTemp = valeur; // Recherche min
        if (valeur > maxTemp) maxTemp = valeur; // Recherche max
    }

    AFFICHAGE_TEMP.innerHTML = "<strong>" + temperatureActuelle + "°C</strong>";
    AFFICHAGE_PLUIE.innerHTML = "Pluie : <strong>" + probabilitePluie + "%</strong>";
    AFFICHAGE_PREVISIONS.innerHTML = "Aujourd'hui : " + minTemp + "°C / " + maxTemp + "°C";

    console.log("Interface météo mise à jour avec succès.");
}

/* --- MODULE SOS --- */

// Fonction synchrone
// Raison : Validation simple des entrées utilisateur
function demarrerSystemeSOS() {
    console.log("Tentative d'activation du système SOS...");
    let numeroNettoye = CHAMP_TELEPHONE.value.replace(/\s/g, ''); // Suppression des espaces

    if (numeroNettoye.length < 10) {
        console.warn("Numéro de téléphone invalide ou trop court.");
        alert("Numéro invalide (trop court).");
        return;
    }

    BOUTON_SOS.innerText = "Activation...";
    BOUTON_SOS.style.backgroundColor = "orange";
    lancerEcouteurCapteur();
}

// Fonction synchrone
// Raison : Ajout immédiat de l'écouteur d'événement 'devicemotion'
function lancerEcouteurCapteur() {
    console.log("Connexion au capteur de mouvement.");
    console.log(CHAMP_TELEPHONE)

    // Appel de la fonction nommée
    window.addEventListener('devicemotion', analyserMouvement); // devicemotion = accéléromètre du téléphone

    surveillanceActive = true;

    BOUTON_SOS.style.display = 'none';
    ELEMENT_STATUT_SOS.innerText = "SURVEILLANCE ACTIVE";
    ELEMENT_STATUT_SOS.style.color = "green";
    ELEMENT_STATUT_SOS.style.fontSize = "20px";
    ELEMENT_STATUT_SOS.style.fontWeight = "bold";

    alert("Système activé. Surveillance active.");
}

// Fonction synchrone
// Raison : Calcul mathématique rapide en temps réel (boucle d'événements)
function analyserMouvement(evenement) {
    if (!surveillanceActive) return;

    vecteurAcceleration = evenement.accelerationIncludingGravity; // Accélération terre

    if (vecteurAcceleration) {
        forceCalculee = Math.sqrt((vecteurAcceleration.x * vecteurAcceleration.x) + (vecteurAcceleration.y * vecteurAcceleration.y) + (vecteurAcceleration.z * vecteurAcceleration.z)); // calcule la magnitude

        if (ELEMENT_DEBUG_FORCE) ELEMENT_DEBUG_FORCE.innerText = "Force : " + Math.round(forceCalculee);

        if (forceCalculee > SEUIL_DETECTION_CHUTE) {
            console.warn("PIC DE FORCE DÉTECTÉ :", forceCalculee);
            declencherAlerte();
        }
    }
}

// Fonction synchrone
// Raison : Mise à jour UI et lancement d'un timer
function declencherAlerte() {
    surveillanceActive = false; // Pause immédiate
    console.log("Procédure d'alerte enclenchée.");

    CORPS_PAGE.classList.add('alerte');
    ELEMENT_STATUT_SOS.innerText = "CHUTE DÉTECTÉE !";
    ELEMENT_STATUT_SOS.style.color = "white";

    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 1000]); // Vibration en motif
    }

    // Appel différé via fonction nommée
    setTimeout(afficherConfirmationUtilisateur, 500); // 0.5 seconde pour laisser le temps à l'utilisateur de voir l'alerte
}

// Fonction synchrone
// Raison : Utilise 'confirm' qui est une boîte de dialogue native bloquante
function afficherConfirmationUtilisateur() {
    console.log("Demande de confirmation utilisateur (Confirm Dialog).");
    let choixUtilisateur = confirm("URGENCE : Envoyer SMS de secours ?");

    if (choixUtilisateur) {
        console.log("Utilisateur a confirmé -> Préparation envoi SMS.");
        genererSmsUrgence();
    } else {
        console.log("Utilisateur a annulé -> Fausse alerte.");
        relancerSurveillance();
    }
}

// Fonction synchrone
// Raison : Réinitialisation simple de l'état
function relancerSurveillance() {
    surveillanceActive = true;
    CORPS_PAGE.classList.remove('alerte');
    ELEMENT_STATUT_SOS.innerText = "SURVEILLANCE ACTIVE";
    ELEMENT_STATUT_SOS.style.color = "green";
}

// Fonction synchrone
// Raison : Construction d'URL et redirection navigateur
function genererSmsUrgence() {
    let numeroDestinataire = CHAMP_TELEPHONE.value;
    let lienGoogleMaps = "";
    let corpsMessage = "";
    let separateurSms = "?"; // point d'interrogation qui sert de séparateur dans l'URL

    if (latitude !== null && longitude !== null) {
        lienGoogleMaps = "http://maps.google.com/?q=" + latitude + "," + longitude;
    } else {
        lienGoogleMaps = "Position GPS inconnue.";
    }

    corpsMessage = "URGENCE : Chute détectée ! Ma position : " + lienGoogleMaps;

    console.log("Ouverture de l'application SMS vers : " + numeroDestinataire);
    console.log("Message généré : " + corpsMessage);

    window.location.href = "sms:" + numeroDestinataire + separateurSms + "body=" + encodeURIComponent(corpsMessage); // Encodage du message, encodeURIComponent qui sert a encoder les caracteres speciaux

    CORPS_PAGE.classList.remove('alerte');
    ELEMENT_STATUT_SOS.innerText = "SMS ouvert.";
}

/* --- API EXERCICES --- */

// Fonction asynchrone
// Raison : Effectue un appel réseau (fetch) pour récupérer la liste des exercices JSON
async function chargerExercices() {
    console.log("Début du téléchargement des exercices...");
    CONTENEUR_LISTE_EXO.innerHTML = "<em>Récupération des exercices...</em>";

    try {
        let reponse = await fetch(URL_API_EXERCICES);

        if (!reponse.ok) {
            throw new Error("Erreur serveur API Exercices");
        }

        let listeExercices = await reponse.json();
        console.log("Liste exercices reçue (JSON brut) :", listeExercices);

        CONTENEUR_LISTE_EXO.innerHTML = "";

        // Mélange du tableau (Algorithme Fisher-Yates)
        for (let i = listeExercices.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = listeExercices[i];
            listeExercices[i] = listeExercices[j];
            listeExercices[j] = temp;
        }

        // Sélection des 3 premiers exercices
        let selectionExercices = listeExercices.slice(0, 3);
        console.log("Sélection aléatoire de 3 exercices :", selectionExercices);

        // Création de l'interface pour chaque exercice
        for (let k = 0; k < selectionExercices.length; k++) {
            creerHtmlExercice(selectionExercices[k]);
        }

    } catch (erreur) {
        console.error("Erreur chargement exercices :", erreur);
        CONTENEUR_LISTE_EXO.innerHTML = "<p style='color:red;'>Serveur injoignable.</p>";
    }
}

// Fonction synchrone
// Raison : Création d'éléments DOM (document.createElement)
function creerHtmlExercice(objetExercice) {
    let elementDiv = document.createElement('div');
    elementDiv.className = "exo-item";

    elementDiv.innerHTML = "<strong>" + objetExercice.nom + "</strong> " +
        "<span style='font-size:0.8em; color:#00695c; font-weight:bold; text-transform:uppercase;'>(" + objetExercice.categorie + ")</span><br>" +
        "<p style='margin:5px 0 0 0; color:#666;'>" + objetExercice.description + "</p>";

    CONTENEUR_LISTE_EXO.appendChild(elementDiv); //appendChild permet d'ajouter un élément enfant à un élément parent comme CONTENEUR_LISTE_EXO
}
