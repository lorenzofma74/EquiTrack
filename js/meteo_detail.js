/******************************************************************************/
/* script: meteo_detail.js */
/******************************************************************************/

/* --- CONFIGURATION GLOBALE --- */
const CONTENEUR_LISTE = document.getElementById("liste-heures");

/* --- VARIABLES GLOBALES (ETAT) --- */
let chaineLocalisation = null;
let objetPosition = null;
let donneesCache = null;

/* --- INITIALISATION & ECOUTEURS --- */

// On attache la fonction de démarrage à l'événement de chargement de la fenêtre
window.addEventListener("load", demarrerPageMeteo);

// Fonction synchrone
// Raison : C'est le point d'entrée qui orchestre le chargement initial sans attente bloquante immédiate
function demarrerPageMeteo() {
    console.log("--- DÉMARRAGE PAGE DÉTAIL MÉTÉO ---");
    
    // Récupération de la position sauvegardée dans le localStorage
    chaineLocalisation = localStorage.getItem("lastKnownLocation");

    if (!chaineLocalisation) {
        console.error("Erreur : Aucune position GPS trouvée dans le stockage.");
        CONTENEUR_LISTE.innerHTML = "<li class='mdl-list__item'>Erreur : Position introuvable. Veuillez activer le GPS sur l'accueil.</li>";
        return;
    }

    objetPosition = JSON.parse(chaineLocalisation);
    console.log("Position chargée depuis le cache :", objetPosition);

    // Lancement de la récupération des données
    recupererDonneesMeteo(objetPosition.lat, objetPosition.lon);
}

// Fonction asynchrone
// Raison : Effectue un appel réseau (fetch) qui nécessite d'attendre la réponse du serveur (await)
async function recupererDonneesMeteo(lat, lon) {
    console.log("Préparation de la requête API pour Lat:", lat, "Lon:", lon);

    // Construction de l'URL (utilisation de let, pas de const)
    let urlApi = "https://api.open-meteo.com/v1/forecast"
        + "?latitude=" + lat
        + "&longitude=" + lon
        + "&hourly=temperature_2m,precipitation_probability,weathercode"
        + "&forecast_days=3" // jusqu'à 3 jours
        + "&models=best_match"
        + "&timezone=auto";

    console.log("URL générée :", urlApi);

    try {
        let reponse = await fetch(urlApi);

        if (!reponse.ok) {
            throw new Error("Erreur HTTP : " + reponse.status);
        }

        let donneesJson = await reponse.json();
        
        console.log("Données reçues de l'API :", donneesJson);

        // Sauvegarde dans le cache
        localStorage.setItem("meteoCacheDetail", JSON.stringify(donneesJson));
        
        // Lancement de l'affichage
        afficherListePrevisions(donneesJson);

    } catch (erreur) {
        console.warn("Échec réseau ou API :", erreur);
        console.log("Basculement sur le mode hors ligne...");
        chargerDonneesCache();
    }
}

// Fonction synchrone
// Raison : Lecture simple du LocalStorage (opération immédiate)
function chargerDonneesCache() {
    let cacheTexte = localStorage.getItem("meteoCacheDetail");
    
    if (cacheTexte) {
        donneesCache = JSON.parse(cacheTexte);
        console.log("Données récupérées du cache local :", donneesCache);
        
        afficherListePrevisions(donneesCache);

        // Ajout d'un bandeau d'avertissement
        CONTENEUR_LISTE.innerHTML = "<li class='mdl-list__item mdl-color--red-100' style='justify-content:center;'><strong>Mode Hors Ligne : Données archivées</strong></li>" + CONTENEUR_LISTE.innerHTML;
    } else {
        console.error("Aucun cache disponible.");
        CONTENEUR_LISTE.innerHTML = "<li class='mdl-list__item'>Pas de connexion internet et aucun cache disponible.</li>";
    }
}

// Fonction synchrone
// Raison : Manipulation du DOM et boucles logiques
function afficherListePrevisions(donnees) {
    console.log("Début de la génération de l'affichage...");
    
    CONTENEUR_LISTE.innerHTML = "";

    // Variables de travail (let uniquement)
    let tableauHeures = donnees.hourly.time;
    let tableauTemperatures = donnees.hourly.temperature_2m;
    let tableauPluie = donnees.hourly.precipitation_probability;
    
    let datePrecedente = "";
    let heureActuelle = new Date().getHours();
    let dateAujourdhui = tableauHeures[0].split("T")[0];

    // Boucle classique (pas de forEach)
    for (let i = 0; i < tableauHeures.length; i++) {
        let dateComplete = tableauHeures[i].split("T")[0];
        let heureTexte = tableauHeures[i].split("T")[1];
        let heureEntiere = parseInt(heureTexte.split(":")[0]);
        let temperature = tableauTemperatures[i];
        let probabilitePluie = tableauPluie[i];

        // 1. Gestion des séparateurs de date
        if (dateComplete !== datePrecedente) {
            let htmlHeader = genererHtmlEnTete(dateComplete);
            CONTENEUR_LISTE.innerHTML += htmlHeader;
            datePrecedente = dateComplete;
        }

        // 2. Détermination du style (passé ou futur)
        let estPasse = (dateComplete === dateAujourdhui && heureEntiere < heureActuelle);

        // 3. Génération de la ligne météo
        let htmlLigne = genererHtmlLigne(heureTexte, temperature, probabilitePluie, estPasse);
        CONTENEUR_LISTE.innerHTML += htmlLigne;
    }

    console.log("Affichage terminé. " + tableauHeures.length + " lignes générées.");
}

// Fonction synchrone
// Raison : Helper de formatage de string (pur calcul)
function genererHtmlEnTete(dateString) {
    let objetDate = new Date(dateString);
    let options = { weekday: 'long', day: 'numeric', month: 'long' };
    let dateLisible = objetDate.toLocaleDateString('fr-FR', options); 
    
    // Met la première lettre en majuscule
    
    dateLisible = dateLisible.charAt(0).toUpperCase() + dateLisible.slice(1);  

    // Retourne le HTML sous forme de string
    return '<li class="mdl-list__item sticky-date mdl-color--grey-200">' +
                '<span class="mdl-list__item-primary-content">' +
                    '<i class="material-icons mdl-list__item-icon mdl-color-text--indigo-500">event</i>' +
                    '<span class="mdl-typography--font-bold mdl-color-text--indigo-700">' + dateLisible + '</span>' +
                '</span>' +
            '</li>';
}

// Fonction synchrone
// Raison : Helper de construction HTML (évite les doublons dans la boucle principale)
function genererHtmlLigne(heure, temp, pluie, estPasse) {
    // Variables de configuration visuelle
    let iconeNom = "wb_sunny";
    let classeCouleur = "mdl-color-text--orange-500";
    let classeFond = "";
    let styleOpacite = "";

    // Logique des icônes
    if (pluie >= 50) {
        iconeNom = "water_drop";
        classeCouleur = "mdl-color-text--blue-500";
        classeFond = "mdl-color--blue-50";
    } else if (pluie > 20) {
        iconeNom = "cloud";
        classeCouleur = "mdl-color-text--blue-grey-400";
    }

    // Gestion de l'opacité pour les heures passées
    if (estPasse) {
        classeCouleur = "mdl-color-text--grey-400";
        styleOpacite = "opacity: 0.5;";
    }

    // Construction du HTML
    return '<li class="mdl-list__item mdl-list__item--two-line ' + classeFond + '" style="' + styleOpacite + '">' +
            '<span class="mdl-list__item-primary-content">' +
                '<i class="material-icons mdl-list__item-avatar grosse-icone ' + classeCouleur + '" style="background:transparent;">' + iconeNom + '</i>' +
                '<span>' + heure + '</span>' +
                '<span class="mdl-list__item-sub-title">Pluie : ' + pluie + '%</span>' +
            '</span>' +
            '<span class="mdl-list__item-secondary-content">' +
                '<span class="mdl-list__item-secondary-info-text">' +
                    '<span class="mdl-typography--font-bold mdl-typography--subhead mdl-color-text--grey-800">' + Math.round(temp) + '°</span>' +
                '</span>' +
            '</span>' +
        '</li>' +
        '<li class="mdl-list__item" style="padding:0; min-height:0; border-bottom: 1px solid #eee;"></li>';
}