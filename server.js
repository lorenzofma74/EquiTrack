const EXPRESS = require('express');
const APP = EXPRESS();
const PORT = 3000;

// Importation des données
const EXERCICES = require('./exercices.json');

// Middleware pour permettre à ta PWA de contacter l'API (CORS)
APP.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    next();
});

// Route principale pour récupérer les exercices
APP.get('/exercices', function (req, res) {
    let categorie_recherchee = req.query.categorie;
    
    // Si une catégorie est précisée dans l'URL (ex: ?categorie=epaules)
    if (categorie_recherchee) {
        let resultats = EXERCICES.filter(function (exo) {
            return exo.categorie === categorie_recherchee;
        });
        return res.json(resultats);
    }

    // Sinon, on renvoie tout
    res.json(EXERCICES);
});

// Route pour obtenir un exercice au hasard selon la catégorie
APP.get('/exercices/random', function (req, res) {
    let categorie_recherchee = req.query.categorie;
    let liste_filtree = EXERCICES;

    if (categorie_recherchee) {
        liste_filtree = EXERCICES.filter(function (exo) {
            return exo.categorie === categorie_recherchee;
        });
    }

    if (liste_filtree.length === 0) {
        return res.status(404).json({ erreur: "Aucun exercice trouvé" });
    }

    let index_au_hasard = Math.floor(Math.random() * liste_filtree.length);
    res.json(liste_filtree[index_au_hasard]);
});

APP.listen(PORT, function () {
    console.log("Ton API équestre est lancée sur http://localhost:" + PORT);
});
