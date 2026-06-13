const mongoose = require('mongoose');
const CategorieDonation = require('../models/CategorieDonation');

const TYPE_PRODUITS = [
  'FRUITS_LEGUMES',
  'PAIN_VIENNOISERIE',
  'PRODUITS_LAITIERS',
  'PLATS_PREPARES',
  'CONSERVES',
  'BOISSONS',
  'AUTRE'
];

const PRIORITES = ['FAIBLE', 'MOYENNE', 'ELEVEE'];

async function listCategories(request, response, next) {
  try {
    const categories = await CategorieDonation.find()
      .sort({ typeProduit: 1 })
      .select('-__v');

    return response.json({ categories });
  } catch (error) {
    return next(error);
  }
}

async function getCategorie(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const categorie = await CategorieDonation.findById(request.params.id).select(
      '-__v'
    );

    if (!categorie) {
      return response.status(404).json({ message: 'Catégorie introuvable' });
    }

    return response.json({ categorie });
  } catch (error) {
    return next(error);
  }
}

async function createCategorie(request, response, next) {
  try {
    const { nom, description, typeProduit, prioriteRedistribution, dureeConservationEstimee } =
      request.body;

    if (!nom || !description || !typeProduit || !dureeConservationEstimee) {
      return response.status(400).json({
        message: 'Les champs nom, description, typeProduit et dureeConservationEstimee sont requis'
      });
    }

    if (!TYPE_PRODUITS.includes(typeProduit)) {
      return response.status(400).json({ message: 'Type de produit invalide' });
    }

    if (prioriteRedistribution && !PRIORITES.includes(prioriteRedistribution)) {
      return response.status(400).json({ message: 'Priorité invalide' });
    }

    const categorie = await CategorieDonation.create({
      nom,
      description,
      typeProduit,
      prioriteRedistribution: prioriteRedistribution || 'MOYENNE',
      dureeConservationEstimee
    });

    return response.status(201).json({
      message: 'Catégorie créée avec succès',
      categorie
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCategorie(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const { nom, description, typeProduit, prioriteRedistribution, dureeConservationEstimee } =
      request.body;

    if (typeProduit && !TYPE_PRODUITS.includes(typeProduit)) {
      return response.status(400).json({ message: 'Type de produit invalide' });
    }

    if (prioriteRedistribution && !PRIORITES.includes(prioriteRedistribution)) {
      return response.status(400).json({ message: 'Priorité invalide' });
    }

    const categorie = await CategorieDonation.findById(request.params.id);

    if (!categorie) {
      return response.status(404).json({ message: 'Catégorie introuvable' });
    }

    if (nom !== undefined) categorie.nom = nom;
    if (description !== undefined) categorie.description = description;
    if (typeProduit !== undefined) categorie.typeProduit = typeProduit;
    if (prioriteRedistribution !== undefined)
      categorie.prioriteRedistribution = prioriteRedistribution;
    if (dureeConservationEstimee !== undefined)
      categorie.dureeConservationEstimee = dureeConservationEstimee;

    await categorie.save();

    return response.json({
      message: 'Catégorie mise à jour avec succès',
      categorie
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteCategorie(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const categorie = await CategorieDonation.findById(request.params.id);

    if (!categorie) {
      return response.status(404).json({ message: 'Catégorie introuvable' });
    }

    await CategorieDonation.deleteOne({ _id: request.params.id });

    return response.json({
      message: 'Catégorie supprimée avec succès'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCategories,
  getCategorie,
  createCategorie,
  updateCategorie,
  deleteCategorie
};
