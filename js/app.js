/******************************************************************************/
/* Constants (CONFIGURATION)                                                  */
/******************************************************************************/

/* Récupération des éléments du DOM */
const STATUS_MAP = document.getElementById("status-map");
const MAP_LINK = document.getElementById("map-link");
const SOUND_BUTTON = document.getElementById("soundButton");
const CLICK_SOUND = document.getElementById("clickSound");

/* Configuration du module SOS */
const SEUIL_CHUTE = 50;
const SOS_BUTTON = document.getElementById("btn-start");
const SOS_INPUT = document.getElementById("tel-urgence");
const SOS_STATUS = document.getElementById("status-sos");
const DEBUG_FORCE = document.getElementById("debug-force");
const BODY_PAGE = document.getElementById("body-page");

/******************************************************************************/
/* Global Variables (ÉTAT DE L'APPLICATION)                                   */
/******************************************************************************/

/* Ces variables sont la "Source de Vérité" unique pour la position */
let latitude = null;
let longitude = null;

/* Gestion de l'état de la carte et de la météo */
let mapInstance = null;    // Pour stocker l'objet carte Leaflet
let markerInstance = null; // Pour stocker le marqueur bleu
let meteoChargee = false;  // Pour ne pas recharger la météo à chaque pas

/* État du système de surveillance SOS */
let surveillanceActive = false;

/******************************************************************************/
/* Listeners (GESTION DES ÉVÉNEMENTS)                                         */
/******************************************************************************/

/* Initialisation unique au chargement */
window.addEventListener("load", initGeolocation);

/* Gestion du son */
if (SOUND_BUTTON) {
    SOUND_BUTTON.addEventListener("click", function () {
        CLICK_SOUND.currentTime = 0;
        CLICK_SOUND.play();
    });
}

/* Activation du système SOS */
if(SOS_BUTTON) {
    SOS_BUTTON.addEventListener("click", demarrerSystemeSOS);
}

/******************************************************************************/
/* Local Storage Functions (PERSISTANCE)                                      */
/******************************************************************************/

function saveLocation(lat, lon)
{
    const LOCATION_DATA = { lat: lat, lon: lon };
    localStorage.setItem("lastKnownLocation", JSON.stringify(LOCATION_DATA));
}

function getCachedLocation()
{
    const LOCATION_STRING = localStorage.getItem("lastKnownLocation");
    if (LOCATION_STRING)
    {
        return JSON.parse(LOCATION_STRING);
    }
    return null;
}

/******************************************************************************/
/* Unified Geolocation Logic (CŒUR DU SYSTÈME)                                */
/******************************************************************************/

function initGeolocation()
{
    MAP_LINK.href = "";
    MAP_LINK.textContent = "";

    if(STATUS_MAP) STATUS_MAP.textContent = "Recherche satellite en cours...";

    if (!navigator.geolocation)
    {
        if(STATUS_MAP) STATUS_MAP.textContent = "Erreur : Géolocalisation non supportée.";
        return;
    }

    /* --- SUIVI CONTINU (SINGLE SOURCE OF TRUTH) --- */
    /* On utilise watchPosition une seule fois pour tout l'app.
       Cela permet de suivre l'utilisateur pour la carte ET d'être prêt pour le SOS. */
    navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    });
}

/**************************************/

/* Cette fonction est appelée à chaque fois que le GPS détecte un mouvement */
function onPositionUpdate(position)
{
    /* Mise à jour des variables globales utilisées par le SOS */
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;

    /* Sauvegarde en cache pour le prochain démarrage */
    saveLocation(latitude, longitude);

    console.log("Mise à jour GPS :", latitude, longitude);

    /* Mise à jour de l'interface utilisateur */
    if(STATUS_MAP) STATUS_MAP.textContent = "";
    MAP_LINK.textContent = "Lat : " + latitude.toFixed(4) + " | Lon : " + longitude.toFixed(4);

    /* 1. Gestion de la Carte (Mise à jour dynamique) */
    updateMapDisplay(latitude, longitude);

    /* 2. Gestion de la Météo (Chargement unique) */
    if (!meteoChargee)
    {
        get_weather(latitude, longitude);
        meteoChargee = true; // On verrouille pour ne pas spammer l'API météo
    }
}

/**************************************/

function onPositionError(error)
{
    console.warn("Perte signal GPS ou Erreur :", error.message);

    /* En cas d'erreur, on tente le cache */
    if (latitude === null)
    {
        const CACHED_LOCATION = getCachedLocation();
        if (CACHED_LOCATION)
        {
            if(STATUS_MAP) STATUS_MAP.textContent = "⚠️ Mode Hors Ligne (Cache utilisé)";

            // On affiche les données du cache, mais on ne met pas à jour les variables globales
            // pour éviter d'envoyer une fausse position SOS si on a bougé depuis.
            updateMapDisplay(CACHED_LOCATION.lat, CACHED_LOCATION.lon);

            // On tente quand même la météo sur la dernière position connue
            if (!meteoChargee) {
                get_weather(CACHED_LOCATION.lat, CACHED_LOCATION.lon);
                meteoChargee = true;
            }
        }
        else
        {
            if(STATUS_MAP) STATUS_MAP.textContent = "Aucune position disponible.";
        }
    }
}

/**************************************/

/* Gestion intelligente de la carte Leaflet */
function updateMapDisplay(lat, lon)
{
    /* Cas 1 : La carte n'existe pas encore -> On la crée */
    if (mapInstance === null)
    {
        /* Création de la carte */
        mapInstance = L.map("map").setView([lat, lon], 15); // Zoom 15 pour voir les détails

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(mapInstance);

        /* Création du marqueur */
        markerInstance = L.marker([lat, lon]).addTo(mapInstance)
            .bindPopup("Vous êtes ici").openPopup();
    }
    /* Cas 2 : La carte existe déjà -> On déplace juste le marqueur et la vue */
    else
    {
        markerInstance.setLatLng([lat, lon]);
        mapInstance.setView([lat, lon]); // La carte suit l'utilisateur
    }
}

/******************************************************************************/
/* Weather Logic (OPTIMISÉE PRÉCISION)                                        */
/******************************************************************************/

function get_weather(lat, lon)
{
    let weather_temp_element = document.getElementById("temperature");
    let weather_rain_element = document.getElementById("rain");
    let day_forecast_element = document.getElementById("day-forecast");

    const WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + lat
        + "&longitude=" + lon
        + "&current_weather=true"
        + "&hourly=temperature_2m,precipitation_probability"
        + "&forecast_days=1"
        + "&models=best_match";

    fetch(WEATHER_URL)
        .then(function (response) { return response.json(); })
        .then(function (data) {

            /* --- SAUVEGARDE EN CACHE --- */
            /* On stocke les données fraîches dans le téléphone */
            localStorage.setItem("meteoCacheSimple", JSON.stringify(data));

            afficherMeteo(data);
        })
        .catch(function (error) {
            console.warn("Erreur météo (Mode Hors Ligne activé) :", error);

            /* --- RÉCUPÉRATION DU CACHE --- */
            /* Si internet plante, on regarde si on a une sauvegarde */
            const CACHE_METEO = localStorage.getItem("meteoCacheSimple");
            if (CACHE_METEO)
            {
                let dataCachee = JSON.parse(CACHE_METEO);
                afficherMeteo(dataCachee);

                /* On ajoute un petit message pour prévenir l'utilisateur */
                day_forecast_element.innerHTML += " <br><span style='color:red; font-size:0.8em'>(Mode Hors Ligne)</span>";
            }
        });
}

/* J'ai sorti l'affichage dans une fonction à part pour ne pas l'écrire 2 fois */
function afficherMeteo(data)
{
    let weather_temp_element = document.getElementById("temperature");
    let weather_rain_element = document.getElementById("rain");
    let day_forecast_element = document.getElementById("day-forecast");

    let temperature = data.current_weather.temperature;
    let currentHour = new Date().getHours();
    let rainprob = data.hourly.precipitation_probability[currentHour];

    weather_temp_element.innerHTML = "<strong>" + temperature + "°C</strong>";
    weather_rain_element.innerHTML = "Pluie : <strong>" + rainprob + "%</strong>";

    let temps = data.hourly.temperature_2m;
    let temp_min = 100;
    let temp_max = -100;

    for(let i=0; i<temps.length; i++) {
        if(temps[i] < temp_min) temp_min = temps[i];
        if(temps[i] > temp_max) temp_max = temps[i];
    }

    day_forecast_element.innerHTML =
        "Aujourd'hui : " + temp_min + "°C / " + temp_max + "°C";
}
/******************************************************************************/
/* Fall Detection Logic (MODULE SOS)                                          */
/******************************************************************************/

function demarrerSystemeSOS()
{
    let numeroNettoye = SOS_INPUT.value.replace(/\s/g, '');

    if (numeroNettoye.length < 10)
    {
        alert("Numéro trop court ou invalide !");
        return;
    }

    /* Feedback UI */
    SOS_BUTTON.innerText = "Activation...";
    SOS_BUTTON.style.backgroundColor = "orange";

    /* Gestion Permission iOS 13+ */
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function')
    {
        DeviceMotionEvent.requestPermission()
            .then(function(state) {
                if (state === 'granted') lancerEcouteurMouvement();
                else {
                    alert("Permission capteurs refusée.");
                    SOS_BUTTON.innerText = "ACTIVER";
                }
            })
            .catch(function(e) { alert("Erreur iOS : " + e); });
    }
    else
    {
        lancerEcouteurMouvement();
    }
}

/**************************************/

function lancerEcouteurMouvement()
{
    window.addEventListener('devicemotion', analyserDonneesAccelerometre);

    surveillanceActive = true;

    SOS_BUTTON.style.display = 'none';
    SOS_STATUS.innerText = "SURVEILLANCE ACTIVE";
    SOS_STATUS.style.color = "green";
    SOS_STATUS.style.fontSize = "20px";
    SOS_STATUS.style.fontWeight = "bold";

    alert("Système activé. La position GPS utilisée sera celle suivie en temps réel sur la carte.");
}

/**************************************/

function analyserDonneesAccelerometre(event)
{
    if (!surveillanceActive) return;

    let acc = event.accelerationIncludingGravity;

    if (acc)
    {
        /* Calcul de la force G (Vecteur 3D) */
        let force = Math.sqrt((acc.x * acc.x) + (acc.y * acc.y) + (acc.z * acc.z));
        DEBUG_FORCE.innerText = "Force : " + Math.round(force);

        if (force > SEUIL_CHUTE)
        {
            declencherAlerteChute();
        }
    }
}

/**************************************/

function declencherAlerteChute()
{
    surveillanceActive = false;
    BODY_PAGE.classList.add('alerte');
    SOS_STATUS.innerText = "CHUTE DÉTECTÉE !";
    SOS_STATUS.style.color = "white";

    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 1000]);

    setTimeout(function() {
        let userConfirme = confirm("URGENCE : Envoyer SMS de secours ?");

        if (userConfirme)
        {
            preparerEtEnvoyerSMS();
        }
        else
        {
            /* Réinitialisation */
            surveillanceActive = true;
            BODY_PAGE.classList.remove('alerte');
            SOS_STATUS.innerText = "SURVEILLANCE ACTIVE";
            SOS_STATUS.style.color = "green";
        }
    }, 500);
}

/**************************************/

function preparerEtEnvoyerSMS()
{
    let numero = SOS_INPUT.value;
    let lienGoogleMaps = "";

    /* UTILISATION DES VARIABLES GLOBALES UNIFIÉES */
    /* On vérifie si on a bien une position GPS fraîche */
    if (latitude !== null && longitude !== null)
    {
        lienGoogleMaps = "http://maps.google.com/?q=" + latitude + "," + longitude;
    }
    else
    {
        lienGoogleMaps = "Position GPS indisponible (Recherche en cours...)";
    }

    let message = "URGENCE PWA : Chute détectée ! Ma position : " + lienGoogleMaps;

    /* Compatibilité iOS/Android */
    let sep = "?";
    if (navigator.userAgent.match(/iPhone|iPad/i)) sep = "&";

    window.location.href = "sms:" + numero + sep + "body=" + encodeURIComponent(message);

    BODY_PAGE.classList.remove('alerte');
    SOS_STATUS.innerText = "SMS ouvert.";
}

