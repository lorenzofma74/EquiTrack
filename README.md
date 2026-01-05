# README.md   
# Dossier Technique : EquiTrack   
Ce document est la référence unique pour la compréhension, la maintenance et l'évolution de la PWA **EquiTrack**. Il détaille l'architecture logicielle, les flux de données et les protocoles de sécurité.   
## 1. Vision Globale (Big Picture)   
**EquiTrack** est une solution logicielle de type **Progressive Web App (PWA)** conçue pour accompagner les cavaliers propriétaires. L'objectif est de transformer un smartphone en un assistant de sécurité et de santé capable de fonctionner de manière optimale même en zone blanche (sans réseau), une situation fréquente lors de balades en extérieur.   
### 1.2 PWA vs Application Native (Android/iOS)   
**Choix :** Progressive Web App.   
**Pourquoi ?**   
  - **Multi-plateforme :** Un seul code fonctionne sur Android et PC sans avoir à redévelopper l'interface pour chaque système.   
  - **Mises à jour fluides :** Dès que le développeur modifie le `service\_worker.js`, l'utilisateur reçoit la mise à jour sans avoir à télécharger une nouvelle version lui même sur le web.   
## Objectifs clefs :   
- **Sécurisation du cavalier** : Détection automatique de chute et procédure d'alerte SMS géolocalisée.   
- **Suivi en temps réel** : Navigation GPS et affichage cartographique dynamique (Leaflet).   
- **Gestion de santé** : Suivi des soins et planification via un agenda intégré (FullCalendar).   
- **Résilience** : Architecture "Offline-first" garantissant l'accès aux données sans connexion internet.   
   
## 2. Architecture et Environnement   
L'application repose sur une architecture **Client-Side** intégrale (Front-end uniquement), garantissant une confidentialité totale : aucune donnée sensible (GPS, contacts) ne quitte le téléphone.   
### 2.1 Stack Technique   
- **Interface (UI)** : Framework *Material Design Lite (MDL)* pour un rendu fluide.   
- **Logique métier** : *Vanilla JavaScript* (ES5/ES6) sans fonctions fléchées pour une compatibilité maximale.   
- **Cartographie** : Bibliothèque *Leaflet* + tuiles *OpenStreetMap*.   
- **Composants externes** : *FullCalendar API* (Agenda) et *Open-Meteo API* (Prévisions).   
- **Hébergement** : Serveur IUT `srv-peda2` .   
   
### 2.2 Structure du Projet (Arborescence)   
```
/EquiTrack
├── index.html              # Interface principale (Carte, Météo flash, SOS)
├── meteo.html              # Vue détaillée des prévisions 72h
├── formul_cheval.html      # Gestion du profil et de l'agenda
├── service_worker.js       # Cœur de la stratégie Offline et gestion du Cache
├── css/
│   └── style.css           # Styles globaux et correctifs visuels MDL
├── js/
│   ├── app.js              # Logique centrale (GPS, SOS, Init)
│   ├── pwa.js              # Gestion de l'installation et des mises à jour
│   ├── meteo_detail.js     # Logique de traitement des données météo
│   └── formul_cheval.js    # Gestion du profil équin et FullCalendar
├── son/
│   └── cheval.mp3          # Feedback sonore d'interaction
└── favicon/                # Manifest PWA et icônes applicatives


```
## 3. Gestion de la Donnée (State Management)   
L'application n'utilise pas de base de données SQL. La persistance est assurée par le **LocalStorage** et le **Cache API**.   
**Pourquoi ?**   
  - **Confidentialité :** Les données de santé du cheval et les positions GPS ne quittent jamais l'appareil de l'utilisateur. C'est un argument de sécurité pour un particulier.   
  - **Zéro Coût :** Pas besoin de payer un hébergement de base de données ou de gérer des comptes utilisateurs côté serveur.   
  - **Vitesse :** L'accès au `localStorage` est quasi instantané car il ne nécessite aucune requête réseau (latence zéro).   
### 3.1 Architecture du LocalStorage   
|                       Clé |     Type |                                                        Description |
|:--------------------------|:---------|:-------------------------------------------------------------------|
|       `lastKnownLocation` | `Object` |  `{lat, lon}` - Dernière position GPS valide pour le mode offline. |
|   `equitrack\_save\_info` | `Object` |                `{nom, race, age}` - Identité du cheval enregistré. |
| `equitrack\_save\_events` |  `Array` |             Liste d'objets `{id, type, date, desc}` pour l'agenda. |
|        `meteoCacheSimple` |   `JSON` |          Cache des dernières données météo pour l'écran d'accueil. |
|        `meteoCacheDetail` |   `JSON` |                 Cache complet des prévisions horaires sur 3 jours. |

### 3.2 Stratégie Offline (Service Worker)   
L'application utilise une stratégie **Cache First**. Lors de l'installation, toutes les ressources (locales et CDN) sont stockées. Le Service Worker intercepte les requêtes réseau pour servir la version en cache, assurant la disponibilité de l'outil sans réseau.   
```
async function caching() {
    const KEYS = await caches.keys();

    /* Si la version a changé, on nettoie tout */
    if(!KEYS.includes(VERSION)) {
        const CACHE = await caches.open(VERSION);

        /* addAll télécharge les ressources (locales et CDN) */
        await CACHE.addAll(RESSOURCES);

        for(const KEY of KEYS) {
            if(KEY !== VERSION) {
                await caches.delete(KEY);
            }
        }
    }
}

async function getResponse(request) {
    const RESPONSE = await caches.match(request);

    if(RESPONSE) {
        return RESPONSE; /* Cache First */
    } else {
        return fetch(request); /* Network Fallback */
    }
}


```
## 4. Modules Critiques   
### 4.1 La Geolocation   
Dans `app.js`, la géolocalisation est gérée par une instance unique pour optimiser la batterie du smartphone.   
- **Méthode** : `navigator.geolocation.watchPosition`.   
- **Variables Globales** : `latitude` et `longitude` sont mises à jour en continu. Elles alimentent simultanément la carte Leaflet (déplacement du marqueur) et le module SOS (préparation du lien Maps).   
- **Optimisation** : En cas de perte de signal, le système bascule sur la clé `lastKnownLocation` du LocalStorage pour maintenir l'affichage.   
   
```
function initGeolocation() {
    if (!navigator.geolocation) {
        if(STATUS_MAP) STATUS_MAP.textContent = "Erreur : Géolocalisation non supportée.";
        return;
    }

    /* --- SUIVI CONTINU--- */
    navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    });
}

function onPositionUpdate(position) {
    /* Mise à jour des variables globales */
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;

    /* Sauvegarde en cache pour le prochain démarrage */
    saveLocation(latitude, longitude);

    /* Mise à jour de la carte Leaflet */
    updateMapDisplay(latitude, longitude);

    /* Chargement unique de la météo */
    if (!meteoChargee) {
        get_weather(latitude, longitude);
        meteoChargee = true;
    }
}


```
### 4.2 Détection de Chute & SOS   
Ce module utilise l'accéléromètre via l'API `DeviceMotionEvent`.   
- **Calcul de Force** : Le système calcule la norme du vecteur accélération totale $G$ :   
    $G = \sqrt{x^2 + y^2 + z^2}$   
- **Seuil** : La détection se déclenche si $G > 50$. Ce paramètre ( `SEUIL\_CHUTE`) est ajustable dans `app.js`.   
   
```
/* Extrait de la logique dans app.js */
function analyserDonneesAccelerometre(event) {
    const ACC = event.accelerationIncludingGravity;
    if (ACC) {
        // Calcul de la force G (Vecteur 3D)
        let force = Math.sqrt((ACC.x * ACC.x) + (ACC.y * ACC.y) + (ACC.z * ACC.z));

        // Affichage debug si nécessaire
        if(DEBUG_FORCE) DEBUG_FORCE.innerText = "Force : " + Math.round(force);

        if (force > SEUIL_CHUTE) {
            declencherAlerteChute();
        }
    }
}


```
### 4.3 Résilience Réseau (Mode Offline)   
- **Météo** : En cas d'échec de l'API (absence de réseau), `meteo\_detail.js` bascule sur `meteoCacheDetail`.    
- **Service Worker** : Les ressources critiques (JS/CSS/Images) sont installées dès la première visite.   
   
   
## 5. Gestion de l'Agenda et Profil    
Ce module convertit le `localStorage` en objets visuels pour l'API **FullCalendar **.dans le fichie*r *`formul\_cheval.js`.   
### 5.1 Synchronisation des Données   
```
function preparerEvenementsPourCalendrier() {
    let rawEvents = recupererEvenements(); // Récupère le JSON du localStorage
    let formattedEvents = [];

    for (let i = 0; i < rawEvents.length; i++) {
        let ev = rawEvents[i];

        let color = '#3788d8'; // Couleur par défaut
        if (ev.type === 'vaccin') color = '#e91e63';
        if (ev.type === 'marechal') color = '#795548';
        if (ev.type === 'osteo') color = '#9c27b0';

        formattedEvents.push({
            id: ev.id,
            title: ev.type.toUpperCase() + (ev.desc ? ' - ' + ev.desc : ''),
            start: ev.date,
            backgroundColor: color,
            borderColor: color
        });
    }
    return formattedEvents;
}


```
## 6. Maintenance et Déploiement   
### 6.1 Lancer l'API node 
1. Aller dnas le fichier du projet 
2. Executer `node server.js`
### 6.1 Mise à jour de l'application (Lifecycle)   
Le cache est lié à la version déclarée dans le Service Worker. Pour déployer une modification :   
1. Modifier les fichiers sources (JS, CSS ou HTML).   
2. Ouvrir `service\_worker.js`.   
3. Incrémenter la valeur de `const VERSION = "3.0";` (ex: passer à `"3.1"`).   
4. Le navigateur détectera le changement et proposera la mise à jour via le bouton géré par `pwa.js`.   
   
### 6.2 Guide de Dépannage   
|               Problème |                                     Cause probable |                                                    Solution |
|:-----------------------|:---------------------------------------------------|:------------------------------------------------------------|
| **Bouton SOS inactif** |                Capteurs bloqués par le navigateur. |          Cliquer sur "ACTIVER" et accepter les permissions. |
|  **Carte vide (gris)** |           Absence de réseau et tuiles non cachées. |         Se connecter une fois pour mettre en cache la zone. |
|     **SMS non envoyé** |       Numéro mal saisi ou application SMS bloquée. |                 Vérifier le format du numéro (10 chiffres). |
|       **GPS imprécis** |    Mode "Économie d'énergie" activé sur le mobile. |     Désactiver l'économie d'énergie ou sortir en extérieur. |

## 7. Guide du Développeur (Handover)   
### 7.1 Conventions de Code (JS)   
Pour garantir la compatibilité et la lisibilité, respecte impérativement ces règles :   
- **Constantes** : Toujours en majuscules (ex: `const MA\_CONSTANTE`).   
- **Variables** : Toujours en minuscules (ex: `let mavariable`).   
- **Fonctions** : Utiliser uniquement des fonctions nommées classiques ( `function nom() {}`).   
- **Interdiction** : L'usage des fonctions fléchées ( `=>`) est proscrit pour assurer les bonnes méthodes de programmations.   
   
### 7.2 Ajouter une fonctionnalité   
Pour ajouter une nouvelle page (ex: "Carnet de santé") :   
1. Créer le fichier HTML avec les classes MDL pour la cohérence visuelle.   
2. Ajouter l'URL au tableau `RESSOURCES` dans `service\_worker.js`.   
3. Créer un script dédié dans `/js/` et utiliser le `localStorage` pour la persistance.   
4. Incrémenter la version du cache pour forcer le déploiement.   
   
   
## 8. Justification des API Spécifiques (Natives et Externes)   
L'application exploite des API précises pour répondre aux contraintes du terrain (mobilité, sécurité, mode hors ligne).   
- **Geolocation API (Native) :**   
    - **Raison :** C'est l'API la plus précise pour le suivi en temps réel. L'utilisation de `watchPosition` plutôt que `getCurrentPosition` permet d'avoir un flux de données continu, indispensable pour recentrer la carte automatiquement pendant que le cavalier se déplace.   
- **DeviceMotionEvent API (Native) :**   
    - **Raison :** Cette API donne accès aux données brutes de l'accéléromètre (axes X, Y, Z). Sans elle, il serait impossible de calculer la force G et donc de détecter une chute. Son intégration native permet d'éviter l'achat de capteurs externes coûteux (objets connectés).   
- **Vibration API (Native) :**   
    - **Raison :** Utilisée pour donner un feedback tactile immédiat lors d'une chute détectée. C'est un signal sensoriel fort qui prévient l'utilisateur que la procédure de secours va être lancée, même s'il ne regarde pas son écran.   
- **Cache API & Service Worker (Native) :**   
    - **Raison :** Ces API permettent d'intercepter les requêtes réseau. C'est ce qui rend l'application "résiliente" : elle continue de fonctionner en forêt sans aucune barre de réseau, car tous les scripts et styles sont servis localement.   
- **Open-Meteo API (Externe) :**   
    - **Raison :** Contrairement à d'autres API météo qui demandent une inscription, celle-ci respecte la vie privée et est extrêmement rapide. Elle fournit les données de précipitations heure par heure, ce qui est vital pour décider de sortir ou de rentrer au box.   
   
   
*Document produit pour le projet EquiTrack - Décembre 2025*   
   
