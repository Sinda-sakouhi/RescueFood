const mongoose = require('mongoose');
const Annonce = require('../models/Annonce');
const CategorieDonation = require('../models/CategorieDonation');
const { suggererCategorie } = require('../utils/categorieIA');
const { calculerUrgence } = require('../utils/urgenceIA');

// GET /api/annonces — liste toutes les annonces actives
async function listAnnonces(request, response, next) {
  try {
    const { type, categorie, statut = 'ACTIVE' } = request.query;

    const filtre = { statut };
    if (type) filtre.type = type;
    if (categorie) filtre.categorieDonation = categorie;

    const annonces = await Annonce.find(filtre)
      .populate('auteur', 'nom prenom role adresse')
      .populate('categorieDonation', 'nom typeProduit')
      .sort({ createdAt: -1 });

    return response.json({ annonces });
  } catch (error) {
    return next(error);
  }
}

// GET /api/annonces/:id — détail d'une annonce
async function getAnnonce(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const annonce = await Annonce.findById(request.params.id)
      .populate('auteur', 'nom prenom role adresse localisation')
      .populate('categorieDonation', 'nom typeProduit prioriteRedistribution');

    if (!annonce) {
      return response.status(404).json({ message: 'Annonce introuvable' });
    }

    return response.json({ annonce });
  } catch (error) {
    return next(error);
  }
}

// POST /api/annonces — créer une annonce
async function createAnnonce(request, response, next) {
  try {
    const {
      type,
      titre,
      description,
      quantiteEstimee,
      unite,
      adresse,
      localisation,
      dateExpiration,
      prixPromo
    } = request.body;

    let { categorieDonation } = request.body;

    // Vérification rôle : FOURNISSEUR publie OFFRE, ONG publie DEMANDE
    if (type === 'OFFRE' && request.user.role !== 'FOURNISSEUR') {
      return response.status(403).json({
        message: 'Seul un fournisseur peut publier une offre'
      });
    }

    if (type === 'DEMANDE' && request.user.role !== 'ONG') {
      return response.status(403).json({
        message: 'Seule une ONG peut publier une demande'
      });
    }

    // IA 1 — Suggérer catégorie si non fournie
    if (!categorieDonation) {
      const typeSuggere = suggererCategorie(titre, description);
      const cat = await CategorieDonation.findOne({ typeProduit: typeSuggere });
      if (cat) categorieDonation = cat._id;
    }

    // IA 2 — Calculer urgence automatiquement selon la date d'expiration
    const { urgence, raison } = calculerUrgence(dateExpiration);

    const annonce = await Annonce.create({
      auteur: request.user._id,
      type,
      titre,
      description,
      categorieDonation,
      quantiteEstimee,
      unite,
      urgence,
      prixPromo: type === 'OFFRE' ? (prixPromo || null) : null,
      adresse: adresse || request.user.adresse,
      localisation: localisation || request.user.localisation,
      dateExpiration,
      statut: 'ACTIVE'
    });

    return response.status(201).json({
      message: 'Annonce publiée avec succès',
      annonce,
      ia: {
        urgenceCalculee: urgence,
        raison
      }
    });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/annonces/:id — modifier une annonce
async function updateAnnonce(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const annonce = await Annonce.findById(request.params.id);

    if (!annonce) {
      return response.status(404).json({ message: 'Annonce introuvable' });
    }

    // Seul l'auteur peut modifier
    if (!annonce.auteur.equals(request.user._id)) {
      return response.status(403).json({
        message: 'Vous ne pouvez modifier que vos propres annonces'
      });
    }

    const champsModifiables = [
      'titre',
      'description',
      'quantiteEstimee',
      'unite',
      'urgence',
      'adresse',
      'localisation',
      'dateExpiration'
    ];

    for (const champ of champsModifiables) {
      if (request.body[champ] !== undefined) {
        annonce[champ] = request.body[champ];
      }
    }

    await annonce.save();

    return response.json({
      message: 'Annonce mise à jour',
      annonce
    });
  } catch (error) {
    return next(error);
  }
}

// DELETE /api/annonces/:id — supprimer une annonce
async function deleteAnnonce(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const annonce = await Annonce.findById(request.params.id);

    if (!annonce) {
      return response.status(404).json({ message: 'Annonce introuvable' });
    }

    // Auteur ou ADMIN peuvent supprimer
    const estAuteur = annonce.auteur.equals(request.user._id);
    const estAdmin = request.user.role === 'ADMIN';

    if (!estAuteur && !estAdmin) {
      return response.status(403).json({
        message: 'Vous ne pouvez pas supprimer cette annonce'
      });
    }

    // On clôture au lieu de supprimer (traçabilité)
    annonce.statut = 'ANNULEE';
    annonce.historiqueStatuts.push({ statut: 'ANNULEE', date: new Date() });
    await annonce.save();

    return response.json({ message: 'Annonce annulée avec succès' });
  } catch (error) {
    return next(error);
  }
}

// GET /api/annonces/mes-annonces — annonces de l'utilisateur connecté (hors ANNULEE)
async function mesAnnonces(request, response, next) {
  try {
    const annonces = await Annonce.find({
      auteur: request.user._id,
      statut: { $ne: 'ANNULEE' }
    })
      .populate('auteur', 'nom prenom')
      .populate('categorieDonation', 'nom typeProduit')
      .sort({ createdAt: -1 });

    return response.json({ annonces });
  } catch (error) {
    return next(error);
  }
}

// GET /api/annonces/suggestion-categorie?titre=...&description=...
async function suggererCategorieIA(request, response, next) {
  try {
    const { titre, description = '' } = request.query;

    if (!titre) {
      return response.status(400).json({ message: 'Le titre est requis' });
    }

    const categorieSuggeree = suggererCategorie(titre, description);

    const categorie = await CategorieDonation.findOne({
      typeProduit: categorieSuggeree
    });

    return response.json({
      message: "Catégorie suggérée par l'IA",
      suggestion: {
        typeProduit: categorieSuggeree,
        categorie: categorie || null,
        confidence: 'basé sur analyse des mots-clés'
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listAnnonces,
  getAnnonce,
  createAnnonce,
  updateAnnonce,
  deleteAnnonce,
  mesAnnonces,
  suggererCategorieIA
};