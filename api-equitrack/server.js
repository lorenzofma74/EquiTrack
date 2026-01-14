/* server.js */
const EXPRESS = require('express');
const CORS = require('cors');
const FS = require('fs'); // Permet de lire des fichiers sur le disque

const APP = EXPRESS();

/* IMPORTANT : Render nous donnera un port dynamique via process.env.PORT.
   Si on est en local, on utilise 3000 par défaut. */
const PORT = process.env.PORT || 3000;

/* On active CORS pour que ton site (hébergé ailleurs) ait le droit de demander des données */
APP.use(CORS());

/* Route principale : quand on va sur /exercices */
APP.get('/exercices', function(req, res) {

    /* On lit le fichier JSON qui est à côté */
    FS.readFile('./exercices.json', 'utf8', function(err, data) {
        if (err) {
            console.error("Erreur de lecture du fichier:", err);
            res.status(500).send("Erreur interne du serveur");
            return;
        }

        /* On transforme le texte en objet JSON et on l'envoie */
        const EXERCICES = JSON.parse(data);
        res.json(EXERCICES);
    });
});

/* On démarre le serveur */
APP.listen(PORT, function() {
    console.log("Serveur API en écoute sur le port " + PORT);
});
