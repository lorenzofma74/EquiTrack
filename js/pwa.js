/******************************************************************************/
/* script: pwa.js */
/******************************************************************************/

const INSTALL_BUTTON = document.getElementById("install_button");
const RELOAD_BUTTON = document.getElementById("reload_button");

// --- VARIABLES GLOBALES ---
let beforeInstallPromptEvent;
let installResult = null;
let registration = null;
let serviceWorker = null;

INSTALL_BUTTON.addEventListener("click", installPwa);
RELOAD_BUTTON.addEventListener("click", reloadPwa);

main();

function main() {
	console.debug("main()");

	if (window.matchMedia("(display-mode: standalone)").matches) {
		console.log("Running as PWA");
		registerServiceWorker();
	}
	else {
		console.log("Running as Web page");
		window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		window.addEventListener("appinstalled", onAppInstalled);
	}
}

function onBeforeInstallPrompt(event) {
	console.debug("onBeforeInstallPrompt()");
	event.preventDefault();
	INSTALL_BUTTON.disabled = false;
	beforeInstallPromptEvent = event;
}

async function installPwa() {
	console.debug("installPwa()");

	installResult = await beforeInstallPromptEvent.prompt();

	switch (installResult.outcome) {
		case "accepted": console.log("PWA Install accepted"); break;
		case "dismissed": console.log("PWA Install dismissed"); break;
	}

	INSTALL_BUTTON.disabled = true;
	window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
}

function onAppInstalled() {
	console.debug("onAppInstalled()");
	registerServiceWorker();
}

async function registerServiceWorker() {
	console.debug("registerServiceWorker()");

	if ("serviceWorker" in navigator) {
		console.log("Register Service Worker…");

		try {
			registration = await navigator.serviceWorker.register("./service_worker.js");
			registration.onupdatefound = onUpdateFound;

			console.log("Service Worker registration successful with scope:", registration.scope);
		}
		catch (error) {
			console.error("Service Worker registration failed:", error);
		}
	}
	else {
		console.warn("Service Worker not supported…");
	}
}

function onUpdateFound(event) {
	console.debug("onUpdateFound()");

	registration = event.target;
	serviceWorker = registration.installing;
	serviceWorker.addEventListener("statechange", onStateChange);
}

function onStateChange(event) {
	serviceWorker = event.target;

	console.debug("onStateChange", serviceWorker.state);

	if (serviceWorker.state == "installed" && navigator.serviceWorker.controller) {
		console.log("PWA Updated");
		RELOAD_BUTTON.disabled = false;
	}
}

function reloadPwa() {
	console.debug("reloadPwa()");
	window.location.reload();
}
