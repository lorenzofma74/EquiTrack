# Dossier Technique : EquiTrack (SAÉ 302)

**Application PWA d'assistance et de sécurité pour cavaliers.**

## 1. Introduction et Contexte
**EquiTrack** est une Progressive Web App (PWA) conçue pour répondre à une problématique de sécurité majeure : la pratique de l'équitation en extérieur (balade), souvent en "zone blanche" (réseau faible ou inexistant).

L'application transforme le smartphone du cavalier en un assistant autonome capable de :
1.  **Détecter une chute** via l'accéléromètre et envoyer un SOS.
2.  **Guider l'utilisateur** via une carte et des prévisions météo localisées.
3.  **Gérer la santé** et le planning du cheval.

* **Public visé :** Cavaliers propriétaires et demi-pensionnaires.
* **Dépôt Source :** [https://github.com/lorenzofma74/EquiTrack/blob/main/README.md]
* **URL de Démonstration :** [https://srv-peda2.iut-acy.univ-smb.fr/flammial/EquiTrack/]

---

## 2. Architecture Technique

### 2.1 Stack Technologique
L'application respecte une architecture **Client-Side** (le code s'exécute sur le téléphone) pour garantir la confidentialité et la rapidité.

* **Langages :** HTML5, CSS3, JavaScript (ES6+).
* **Interface (UI) :** Framework **Material Design Lite (MDL)** pour une UX native Android.
* **Moteur PWA :** Service Worker natif & Web App Manifest.
* **Backend (API Exercices) :** Node.js avec Express, hébergé sur **Render**.

### 2.2 Librairies Externes Intégrées
* **Leaflet.js** : Affichage de la cartographie (alternative légère à Google Maps respectueuse de la vie privée).
* **FullCalendar** : Gestion de l'agenda visuel pour les soins du cheval.


---

## 3. Domaine : Connectivité et API Externes

L'application interagit avec deux API distinctes pour enrichir l'expérience utilisateur.

### 3.1 Météo (Open-Meteo)
Utilisée pour les prévisions locales sans clé API.
* **Endpoint :** `https://api.open-meteo.com/v1/forecast`
* **Paramètres :** `latitude`, `longitude`, `hourly=temperature_2m,precipitation_probability`.
* **Gestion d'erreur :** En cas d'échec du `fetch` (ex: pas de réseau), l'application charge automatiquement le dernier JSON valide stocké dans le `localStorage` (clé `cacheMeteoDonnees`).

### 3.2 Bibliothèque d'Exercices (API Personnalisée)
Une API REST développée spécifiquement pour le projet, hébergée sur la plateforme Cloud Render.
* **Endpoint :** `https://api-equitrack.onrender.com/exercices`
* **Traitement Local :** Une fois la liste JSON reçue, l'algorithme de **Fisher-Yates** est appliqué côté client pour mélanger les exercices aléatoirement et n'en afficher que 3 à l'utilisateur.

---

## 4. Domaine : PWA et Mode Hors-Ligne

C'est le cœur de la résilience de l'application exigée par le cahier des charges.

### 4.1 Stratégie de Cache (Service Worker)
Le fichier `service_worker.js` implémente une stratégie **"Cache First" (Priorité Cache)** :
1.  Le SW intercepte toute requête réseau (`fetch`).
2.  Il vérifie si la ressource existe dans le cache nommé `version_4.4_android`.
3.  Si **OUI** : Il sert le fichier immédiatement (chargement instantané).
4.  Si **NON** : Il tente de la télécharger sur le réseau et la met en cache pour la prochaine fois.

**Fichiers précachés à l'installation (`install` event) :**
* `index.html`, `formul_cheval.html`, `meteo.html`
* Scripts JS (`app.js`, `pwa.js`...) et Styles CSS.

### 4.2 Expérience Offline
Si l'utilisateur coupe le réseau :
* **L'interface** se charge normalement sans le "dinosaure Chrome".
* **La météo** affiche les dernières données connues avec une mention rouge "(Mode Hors Ligne)".
* **La carte** affiche les tuiles précédemment visitées (cache navigateur).

### 4.3 Installabilité (A2HS)
Le fichier `manifest.webmanifest` (dans `/favicon`) configure l'application comme "installable" :
* `display: standalone` (supprime la barre d'URL du navigateur).
* Icônes configurées pour Android et iOS.
* Gestion de l'événement `beforeinstallprompt` dans `pwa.js` pour proposer un bouton d'installation personnalisé "Installer l'app".

---

## 5. Domaine : Persistance des Données

L'application n'utilise pas de base de données SQL distante. La persistance est locale via le **LocalStorage**, assurant que les données privées restent sur l'appareil de l'utilisateur.

### Modèle de Données (Clés utilisées)

| Clé LocalStorage | Type | Description |
| :--- | :--- | :--- |
| `dernierePositionConnue` | JSON `{lat, lon}` | Sauvegarde la dernière position GPS valide pour recentrer la carte au démarrage suivant. |
| `equitrack_save_info` | JSON | Profil du cheval : `{ nom, race, age }`. |
| `equitrack_save_events` | Tableau JSON | Liste des événements de santé : `[{ id, type, date, desc }, ...]`. |
| `meteoCacheDetail` | JSON | Copie complète de la réponse API Météo pour consultation hors-ligne. |
| `cacheMeteoDonnees` | JSON | Cache léger pour la météo de la page d'accueil. |

**Logique de sauvegarde :** Les données sont écrites de manière synchrone à chaque modification (clic sur "Enregistrer" ou nouvel ajout au planning).

---

## 6. Domaine : Intégration Matériel (Device API)

L'application exploite les capteurs natifs du smartphone via JavaScript (Vanilla).

### 6.1 Géolocalisation
* **API :** `navigator.geolocation.watchPosition`
* **Usage :** Suivi en temps réel. Contrairement à `getCurrentPosition`, `watchPosition` met à jour les variables globales `latitude` et `longitude` dès que l'utilisateur bouge.
* **Code :** Voir fonction `surReceptionPosition` dans `app.js`.

### 6.2 Accéléromètre (Détection de Chute)
* **API :** `DeviceMotionEvent` (via l'événement `window.addEventListener('devicemotion', ...)`)
* **Algorithme :** Calcul de la force G vectorielle (Norme du vecteur 3D).
    > Formule : `G = racine_carrée(x² + y² + z²)`
* **Seuil :** Une alerte se déclenche si `G > 50` (constante `SEUIL_DETECTION_CHUTE`).

### 6.3 Vibreur
* **API :** `navigator.vibrate([500, 200, ...])`
* **Usage :** Retour haptique immédiat lorsqu'une chute est détectée pour avertir le cavalier, même si le téléphone est dans la poche.

---

## 7. Guide d'Installation et Maintenance

### 7.1 Prérequis pour le développement
* Un éditeur de code (VS Code recommandé).
* Extension **Live Server** (pour simuler un serveur HTTP local, obligatoire pour le bon fonctionnement du Service Worker).
* Navigateur : Chrome (Desktop & Mobile) ou Edge pour les outils de débuggage PWA.

### 7.2 Procédure de mise à jour
Le cycle de mise à jour des clients est géré par le versioning du cache.
1.  Effectuer les modifications dans le code HTML/JS/CSS.
2.  Ouvrir le fichier `service_worker.js`.
3.  Incrémenter la constante de version : `const VERSION_CACHE = "version_4.5_android";`.
4.  Au prochain rechargement, le navigateur détectera le changement binaire du SW et proposera la mise à jour via le bouton "Mise à jour dispo" (géré par `pwa.js`).

### 7.3 Structure des fichiers
```bash
/EquiTrack
├── index.html           # Dashboard (Carte, SOS, Météo flash)
├── formul_cheval.html   # Gestion Profil & Calendrier
├── meteo.html           # Page météo détaillée
├── service_worker.js    # Cœur de la PWA (Cache & Réseau)
├── js/
│   ├── app.js           # Logique principale (GPS, API, Capteurs)
│   ├── formul_cheval.js # Logique FullCalendar & Stockage
│   ├── meteo_detail.js  # Logique page météo
│   └── pwa.js           # Gestion de l'installation A2HS
└── css/                 # Styles personnalisés & correctifs MDL
```

---

## 8. Conclusion
L'application remplit des critères du cahier des charges SAÉ 302 :
1.  **Application Communicante :** API Météo + API Node.js.
2.  **PWA Offline :** Service Worker Cache First + Manifest.
3.  **Persistance :** LocalStorage complet.
4.  **Capteurs :** GPS, Accéléromètre, Vibreur.
5.  **Documentation :** Ce présent document.

*Document produit pour le projet EquiTrack - Janvier 2026*
                        
