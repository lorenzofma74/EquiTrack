/******************************************************************************/
/* script: service_worker.js */
/******************************************************************************/

/* --- CONFIGURATION GLOBALE --- */
// Incrémentez cette variable pour forcer la mise à jour du cache sur les téléphones
const VERSION_CACHE = "version_4.4_android";

// Liste des fichiers nécessaires au fonctionnement hors ligne
const LISTE_FICHIERS_CACHE = [
    "./",
    "./index.html",
    "./formul_cheval.html",
    "./meteo.html",
    "./js/pwa.js",
    "./js/app.js",
    "./css/style.css"
];

/* --- ECOUTEURS D'EVENEMENTS --- */

// Installation : Mise en cache initiale
self.addEventListener("install", surInstallation);

// Activation : Nettoyage des anciens caches
self.addEventListener("activate", surActivation);

// Fetch : Interception des requêtes réseau
self.addEventListener("fetch", surRequete);

/* --- FONCTIONS D'INSTALLATION --- */

// Fonction synchrone
// Raison : C'est le point d'entrée de l'événement, elle délègue le travail asynchrone à 'effectuerMiseEnCache' via waitUntil
function surInstallation(evenement) {
    console.log("[ServiceWorker] Événement 'install' déclenché.");
    console.log("[ServiceWorker] Version actuelle : " + VERSION_CACHE);

    // Force le Service Worker à s'activer sans attendre
    self.skipWaiting();

    // On attend que la mise en cache soit terminée
    evenement.waitUntil(effectuerMiseEnCache());
}

// Fonction asynchrone
// Raison : L'ouverture du cache et l'ajout des fichiers (addAll) sont des opérations qui prennent du temps (Promesses)
async function effectuerMiseEnCache() {
    console.log("[ServiceWorker] Ouverture du cache...");
    
    try {
        // Utilisation de 'let' (pas de const locale)
        let espaceCache = await caches.open(VERSION_CACHE);
        
        console.log("[ServiceWorker] Ajout des fichiers au cache :", LISTE_FICHIERS_CACHE);
        await espaceCache.addAll(LISTE_FICHIERS_CACHE);
        
        console.log("[ServiceWorker] Mise en cache terminée avec succès.");

    } catch (erreur) {
        console.error("[ServiceWorker] Erreur pendant la mise en cache :", erreur);
    }
}

/* --- FONCTIONS D'ACTIVATION --- */

// Fonction synchrone
// Raison : Point d'entrée de l'événement, délègue à 'nettoyerVieuxCaches'
function surActivation(evenement) {
    console.log("[ServiceWorker] Événement 'activate' déclenché.");

    // Permet au SW de contrôler les pages immédiatement
    evenement.waitUntil(clients.claim());

    // Nettoyage des versions précédentes
    evenement.waitUntil(nettoyerVieuxCaches());
}

// Fonction asynchrone
// Raison : La lecture des clés de cache et leur suppression (delete) sont asynchrones
async function nettoyerVieuxCaches() {
    console.log("[ServiceWorker] Vérification des anciens caches...");

    try {
        let listeCles = await caches.keys();
        
        // Boucle 'for' classique (pas de forEach, pas de map, pas de fonction fléchée)
        for (let i = 0; i < listeCles.length; i++) {
            let cleActuelle = listeCles[i];

            if (cleActuelle !== VERSION_CACHE) {
                console.log("[ServiceWorker] Suppression du vieux cache détecté : " + cleActuelle);
                await caches.delete(cleActuelle);
            }
        }
        
        console.log("[ServiceWorker] Nettoyage terminé. Cache actif : " + VERSION_CACHE);

    } catch (erreur) {
        console.error("[ServiceWorker] Erreur lors du nettoyage du cache :", erreur);
    }
}

/* --- FONCTIONS DE GESTION RESEAU (FETCH) --- */

// Fonction synchrone
// Raison : Intercepte la requête et doit répondre immédiatement avec 'respondWith' qui prend une Promesse
function surRequete(evenement) {
    // console.log("[ServiceWorker] Interception requête : " + evenement.request.url);
    
    // On répond avec notre stratégie personnalisée
    evenement.respondWith(strategieCacheOuReseau(evenement.request));
}

// Fonction asynchrone
// Raison : Doit attendre la réponse du cache (match) ou du réseau (fetch)
async function strategieCacheOuReseau(requete) {
    // Stratégie : Cache First (Priorité Cache), puis Réseau + Mise à jour Cache

    try {
        // 1. On regarde si on a déjà la réponse en local
        let reponseCachee = await caches.match(requete);

        if (reponseCachee) {
            // console.log("[ServiceWorker] Trouvé dans le cache : " + requete.url);
            return reponseCachee;
        }

        // 2. Si pas en cache, on va chercher sur internet
        // console.log("[ServiceWorker] Pas en cache, appel réseau : " + requete.url);
        let reponseReseau = await fetch(requete);

        // 3. Si la réponse réseau est valide, on la sauvegarde pour la prochaine fois
        if (reponseReseau && reponseReseau.status === 200 && requete.method === "GET") {
            
            // On doit cloner la réponse car elle ne peut être lue qu'une fois
            let reponseClone = reponseReseau.clone();
            
            let espaceCache = await caches.open(VERSION_CACHE);
            espaceCache.put(requete, reponseClone);
            
            // console.log("[ServiceWorker] Nouvelle ressource mise en cache : " + requete.url);
        }

        return reponseReseau;

    } catch (erreur) {
        console.error("[ServiceWorker] Échec fetch (Hors ligne ?) :", erreur);
        // Ici, pas de redirection spécifique iOS/Ipad, on laisse l'erreur ou on pourrait renvoyer une page offline.html générique
    }
}