/******************************************************************************/
/* Constants                                                                  */
/******************************************************************************/

// On change la version pour forcer la mise à jour du cache
const VERSION = "3.0"; 

const RESSOURCES = [
    // --- Fichiers Locaux ---
	"./",
	"./index.html",
	"./formul_cheval.html", // N'oublie pas de cacher les autres pages HTML aussi !
	"./meteo.html",
	"./service_worker.js",

	"./css/style.css",

    // Images & Favicons
	"./favicon/apple-touch-icon.png",
	"./favicon/favicon.ico",
	"./favicon/favicon.svg",
	"./favicon/favicon-96x96.png",
	"./favicon/site.webmanifest",
	"./favicon/web-app-manifest-192x192.png",
	"./favicon/web-app-manifest-512x512.png",

    // Scripts locaux
	"./js/pwa.js",
    "./js/app.js",
    "./js/formul_cheval.js",
    "./js/meteo_detail.js",
    "./son/cheval.mp3",

    // --- Bibliothèques Externes (CDN) ---
    // Il est crucial de les cacher pour que le design fonctionne hors ligne
    "https://code.getmdl.io/1.3.0/material.teal-amber.min.css",
    "https://code.getmdl.io/1.3.0/material.min.js",
    "https://fonts.googleapis.com/icon?family=Material+Icons",
    "https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;700&family=Roboto:wght@300;400;500&display=swap",
    
    // Leaflet (Carte)
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    
    // FullCalendar (Agenda)
    "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js"
];

/******************************************************************************/
/* Listeners                                                                  */
/******************************************************************************/

self.addEventListener("install", onInstall);
self.addEventListener("fetch", onFetch);

/******************************************************************************/
/* Install                                                                    */
/******************************************************************************/

function onInstall(event)
{
	console.debug("onInstall()");

	event.waitUntil(caching());
	// Force le nouveau service worker à prendre le contrôle immédiatement
	self.skipWaiting(); 
}

/******************************************************************************/

async function caching()
{
	console.debug("caching()");

	const KEYS = await caches.keys();

	// Si la version a changé, on nettoie tout
	if( ! KEYS.includes(VERSION))
	{
		console.log("Caching version:", VERSION);
		const CACHE = await caches.open(VERSION);
		
		// addAll va télécharger toutes les ressources listées (locales et CDN)
		await CACHE.addAll(RESSOURCES);

		for(const KEY of KEYS)
		{
			if(KEY !== VERSION)
			{
				console.log("Suppress old cache version:", KEY);
				await caches.delete(KEY);
			}
		}
	}
}

/******************************************************************************/
/* Fetch                                                                      */
/******************************************************************************/

function onFetch(event)
{
	// console.debug("onFetch()", event.request.url); 
    // Commenté pour ne pas spammer la console avec chaque tuile de map

	event.respondWith(getResponse(event.request));
}

/******************************************************************************/

async function getResponse(request)
{
	const RESPONSE = await caches.match(request);

	if(RESPONSE)
	{
		// Si c'est dans le cache (fichiers locaux ou CDN sauvegardés), on le rend direct
		// C'est le principe "Cache First"
		return RESPONSE;
	}
	else
	{
		// Sinon (API météo, tuiles de la carte OpenStreetMap...), on tente internet
		// Si internet échoue, le JS de tes pages (app.js) gère déjà le fallback localStorage
		return fetch(request);
	}
}
