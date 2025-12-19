/******************************************************************************/
/* script: meteo_detail.js (Version Full MDL Design)                          */
/******************************************************************************/

const LISTE_CONTAINER = document.getElementById("liste-heures");

window.addEventListener("load", chargerMeteoDetaillee);

function chargerMeteoDetaillee()
{
    const LOCATION_STRING = localStorage.getItem("lastKnownLocation");

    if (!LOCATION_STRING)
    {
        LISTE_CONTAINER.innerHTML = "<li class='mdl-list__item'>Erreur : Position introuvable.</li>";
        return;
    }

    const POSITION = JSON.parse(LOCATION_STRING);
    recupererDonneesAPI(POSITION.lat, POSITION.lon);
}

function recupererDonneesAPI(lat, lon)
{
    const URL = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + lat
        + "&longitude=" + lon
        + "&hourly=temperature_2m,precipitation_probability,weathercode"
        + "&forecast_days=3"
        + "&models=best_match"
        + "&timezone=auto";

    fetch(URL)
        .then(function(response) { return response.json(); })
        .then(function(data) {

            /* SAUVEGARDE */
            localStorage.setItem("meteoCacheDetail", JSON.stringify(data));

            afficherListe(data);
        })
        .catch(function(err) {
            console.error("Mode Hors Ligne", err);

            /* RECUPERATION */
            const CACHE = localStorage.getItem("meteoCacheDetail");
            if (CACHE)
            {
                let dataCachee = JSON.parse(CACHE);
                afficherListe(dataCachee);

                /* Petit message d'alerte en haut de la liste */
                LISTE_CONTAINER.innerHTML = "<li class='mdl-list__item mdl-color--red-100'>Mode Hors Ligne : Données archivées</li>" + LISTE_CONTAINER.innerHTML;
            }
            else
            {
                LISTE_CONTAINER.innerHTML = "<li class='mdl-list__item'>Pas de connexion et pas de cache disponible.</li>";
            }
        });
}
function afficherListe(data)
{
    LISTE_CONTAINER.innerHTML = "";

    let horaires = data.hourly.time;
    let temperatures = data.hourly.temperature_2m;
    let pluies = data.hourly.precipitation_probability;

    let datePrecedente = "";
    let heureActuelle = new Date().getHours();
    let aujourdhui = data.hourly.time[0].split("T")[0];

    for (let i = 0; i < horaires.length; i++)
    {
        let dateComplete = horaires[i].split("T")[0];
        let heureSeule = horaires[i].split("T")[1];
        let h = parseInt(heureSeule.split(":")[0]);

        /* --- 1. SÉPARATEUR DE DATE (Design MDL) --- */
        if (dateComplete !== datePrecedente)
        {
            let dateObj = new Date(dateComplete);
            let options = { weekday: 'long', day: 'numeric', month: 'long' };
            let dateLisible = dateObj.toLocaleDateString('fr-FR', options);
            dateLisible = dateLisible.charAt(0).toUpperCase() + dateLisible.slice(1);

            // Utilisation de classes MDL pour le fond gris clair (grey-200) et le texte indigo
            let htmlHeader =
            '<li class="mdl-list__item sticky-date mdl-color--grey-200">' +
                '<span class="mdl-list__item-primary-content">' +
                    '<i class="material-icons mdl-list__item-icon mdl-color-text--indigo-500">event</i>' +
                    '<span class="mdl-typography--font-bold mdl-color-text--indigo-700">' + dateLisible + '</span>' +
                '</span>' +
            '</li>';

            LISTE_CONTAINER.innerHTML += htmlHeader;
            datePrecedente = dateComplete;
        }

        /* --- 2. LOGIQUE DU DESIGN (Couleurs MDL) --- */
        let icone = "wb_sunny";
        let classeCouleurIcone = "mdl-color-text--orange-500"; // Jaune/Orange Material
        let classeFondLigne = ""; // Fond blanc par défaut

        // Si risque de pluie > 50%
        if (pluies[i] >= 50) {
            icone = "water_drop";
            classeCouleurIcone = "mdl-color-text--blue-500"; // Bleu Material
            classeFondLigne = "mdl-color--blue-50"; // Fond bleu très pâle (classe MDL officielle)
        }
        else if (pluies[i] > 20) {
            icone = "cloud";
            classeCouleurIcone = "mdl-color-text--blue-grey-400"; // Gris bleuté Material
        }

        // Si l'heure est passée (pour le jour actuel)
        let styleOpacite = "";
        if (dateComplete === aujourdhui && h < heureActuelle) {
            classeCouleurIcone = "mdl-color-text--grey-400";
            styleOpacite = "opacity: 0.5;";
        }

        /* --- 3. GÉNÉRATION DE LA LIGNE (Classes MDL uniquement) --- */
        let htmlItem =
        '<li class="mdl-list__item mdl-list__item--two-line ' + classeFondLigne + '" style="' + styleOpacite + '">' +

            /* GAUCHE : Icône + Heure + Pluie */
            '<span class="mdl-list__item-primary-content">' +
                // Avatar (Icône)
                '<i class="material-icons mdl-list__item-avatar grosse-icone ' + classeCouleurIcone + '" style="background:transparent;">' + icone + '</i>' +

                // Heure
                '<span>' + heureSeule + '</span>' +

                // Sous-titre (Probabilité pluie)
                '<span class="mdl-list__item-sub-title">' +
                   'Pluie : ' + pluies[i] + '%' +
                '</span>' +
            '</span>' +

            /* DROITE : Température */
            '<span class="mdl-list__item-secondary-content">' +
                '<span class="mdl-list__item-secondary-info-text">' +
                    // Température en Gras et couleur sombre
                    '<span class="mdl-typography--font-bold mdl-typography--subhead mdl-color-text--grey-800">' +
                        Math.round(temperatures[i]) + '°' +
                    '</span>' +
                '</span>' +
            '</span>' +

        '</li>' +
        // Ligne de séparation fine MDL
        '<li class="mdl-list__item" style="padding:0; min-height:0; border-bottom: 1px solid #eee;"></li>';

        LISTE_CONTAINER.innerHTML += htmlItem;
    }
}
