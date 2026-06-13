const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const CategorieDonation = require('../models/CategorieDonation');

const STATUTS = [
  'CREE',
  'EN_ATTENTE_VALIDATION',
  'VALIDE',
  'RESERVE',
  'EN_COLLECTE',
  'LIVRE',
  'ANNULE'
];

const URGENCES = ['FAIBLE', 'MOYENNE', 'ELEVEE'];
const UNITES = ['KG', 'G', 'L', 'UNITE', 'PORTION'];

async function listDonations(request, response, next) {
  try {
    const {
      statut,
      urgence,
      categorie,
      fournisseur,
      beneficiaire,
      page = 1,
      limit = 20
    } = request.query;

    const filter = {};

    if (statut && STATUTS.includes(statut)) {
      filter.statut = statut;
    }

    if (urgence && URGENCES.includes(urgence)) {
      filter.urgence = urgence;
    }

    if (categorie) {
      filter.categorieDonation = categorie;
    }

    if (fournisseur) {
      filter.fournisseur = fournisseur;
    }

    if (beneficiaire) {
      filter.beneficiaire = beneficiaire;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate('fournisseur', 'email nom prenom')
        .populate('beneficiaire', 'email nom prenom')
        .populate('categorieDonation', 'nom typeProduit')
        .populate('matchingSource')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Donation.countDocuments(filter)
    ]);

    return response.json({
      donations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function getDonation(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const donation = await Donation.findById(request.params.id)
      .populate('fournisseur', 'email nom prenom telephone adresse')
      .populate('beneficiaire', 'email nom prenom telephone adresse')
      .populate('categorieDonation', 'nom description typeProduit prioriteRedistribution')
      .populate('matchingSource')
      .select('-__v');

    if (!donation) {
      return response.status(404).json({ message: 'Don introuvable' });
    }

    return response.json({ donation });
  } catch (error) {
    return next(error);
  }
}

async function createDonation(request, response, next) {
  try {
    const {
      titre,
      description,
      categorieDonation,
      compositionLot,
      quantiteEstimee,
      unite,
      poidsTotalKg,
      images,
      temperatureStockage,
      conditionsStockage,
      urgence,
      dateDisponibilite,
      dateLimiteCollecte,
      adresseCollecte,
      localisationCollecte
    } = request.body;

    if (
      !titre ||
      !categorieDonation ||
      !compositionLot ||
      !quantiteEstimee ||
      !unite ||
      !poidsTotalKg ||
      !images ||
      !dateDisponibilite ||
      !dateLimiteCollecte ||
      !adresseCollecte ||
      !localisationCollecte
    ) {
      return response.status(400).json({
        message:
          'Les champs titre, categorieDonation, compositionLot, quantiteEstimee, unite, poidsTotalKg, images, dateDisponibilite, dateLimiteCollecte, adresseCollecte et localisationCollecte sont requis'
      });
    }

    if (!mongoose.isValidObjectId(categorieDonation)) {
      return response.status(400).json({ message: 'Identifiant de catégorie invalide' });
    }

    const categorie = await CategorieDonation.findById(categorieDonation);
    if (!categorie) {
      return response.status(404).json({ message: 'Catégorie introuvable' });
    }

    if (!UNITES.includes(unite)) {
      return response.status(400).json({ message: 'Unité invalide' });
    }

    if (urgence && !URGENCES.includes(urgence)) {
      return response.status(400).json({ message: 'Urgence invalide' });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return response.status(400).json({
        message: 'Une donation doit contenir au moins une image'
      });
    }

    if (
      !localisationCollecte ||
      localisationCollecte.latitude === undefined ||
      localisationCollecte.longitude === undefined
    ) {
      return response.status(400).json({
        message: 'La localisation doit contenir latitude et longitude'
      });
    }

    const donation = await Donation.create({
      titre,
      description: description || '',
      fournisseur: request.user._id,
      categorieDonation,
      compositionLot,
      quantiteEstimee,
      unite,
      poidsTotalKg,
      images,
      temperatureStockage: temperatureStockage || null,
      conditionsStockage: conditionsStockage || '',
      urgence: urgence || 'MOYENNE',
      dateDisponibilite: new Date(dateDisponibilite),
      dateLimiteCollecte: new Date(dateLimiteCollecte),
      adresseCollecte,
      localisationCollecte
    });

    return response.status(201).json({
      message: 'Don créé avec succès',
      donation
    });
  } catch (error) {
    return next(error);
  }
}

async function updateDonation(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const donation = await Donation.findById(request.params.id);

    if (!donation) {
      return response.status(404).json({ message: 'Don introuvable' });
    }

    if (
      request.user.role !== 'ADMIN' &&
      !donation.fournisseur.equals(request.user._id)
    ) {
      return response.status(403).json({
        message: 'Vous ne pouvez modifier que vos propres dons'
      });
    }

    const {
      titre,
      description,
      categorieDonation,
      compositionLot,
      quantiteEstimee,
      unite,
      poidsTotalKg,
      images,
      temperatureStockage,
      conditionsStockage,
      urgence,
      dateDisponibilite,
      dateLimiteCollecte,
      adresseCollecte,
      localisationCollecte
    } = request.body;

    if (categorieDonation) {
      if (!mongoose.isValidObjectId(categorieDonation)) {
        return response.status(400).json({ message: 'Identifiant de catégorie invalide' });
      }

      const categorie = await CategorieDonation.findById(categorieDonation);
      if (!categorie) {
        return response.status(404).json({ message: 'Catégorie introuvable' });
      }
      donation.categorieDonation = categorieDonation;
    }

    if (unite && !UNITES.includes(unite)) {
      return response.status(400).json({ message: 'Unité invalide' });
    }

    if (urgence && !URGENCES.includes(urgence)) {
      return response.status(400).json({ message: 'Urgence invalide' });
    }

    if (images && (!Array.isArray(images) || images.length === 0)) {
      return response.status(400).json({
        message: 'Une donation doit contenir au moins une image'
      });
    }

    if (titre !== undefined) donation.titre = titre;
    if (description !== undefined) donation.description = description;
    if (compositionLot !== undefined) donation.compositionLot = compositionLot;
    if (quantiteEstimee !== undefined) donation.quantiteEstimee = quantiteEstimee;
    if (unite !== undefined) donation.unite = unite;
    if (poidsTotalKg !== undefined) donation.poidsTotalKg = poidsTotalKg;
    if (images !== undefined) donation.images = images;
    if (temperatureStockage !== undefined) donation.temperatureStockage = temperatureStockage;
    if (conditionsStockage !== undefined) donation.conditionsStockage = conditionsStockage;
    if (urgence !== undefined) donation.urgence = urgence;
    if (dateDisponibilite !== undefined) donation.dateDisponibilite = new Date(dateDisponibilite);
    if (dateLimiteCollecte !== undefined) donation.dateLimiteCollecte = new Date(dateLimiteCollecte);
    if (adresseCollecte !== undefined) donation.adresseCollecte = adresseCollecte;
    if (localisationCollecte !== undefined) donation.localisationCollecte = localisationCollecte;

    await donation.save();

    return response.json({
      message: 'Don mis à jour avec succès',
      donation
    });
  } catch (error) {
    return next(error);
  }
}

async function updateDonationStatut(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const { statut } = request.body;

    if (!statut) {
      return response.status(400).json({ message: 'Le statut est requis' });
    }

    if (!STATUTS.includes(statut)) {
      return response.status(400).json({ message: 'Statut invalide' });
    }

    const donation = await Donation.findById(request.params.id);

    if (!donation) {
      return response.status(404).json({ message: 'Don introuvable' });
    }

    donation.statut = statut;
    await donation.save();

    return response.json({
      message: 'Statut du don mis à jour avec succès',
      donation
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteDonation(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const donation = await Donation.findById(request.params.id);

    if (!donation) {
      return response.status(404).json({ message: 'Don introuvable' });
    }

    if (
      request.user.role !== 'ADMIN' &&
      !donation.fournisseur.equals(request.user._id)
    ) {
      return response.status(403).json({
        message: 'Vous ne pouvez supprimer que vos propres dons'
      });
    }

    if (donation.statut === 'EN_COLLECTE' || donation.statut === 'LIVRE') {
      return response.status(400).json({
        message: 'Impossible de supprimer un don en cours de collecte ou livré'
      });
    }

    await Donation.deleteOne({ _id: request.params.id });

    return response.json({
      message: 'Don supprimé avec succès'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listDonations,
  getDonation,
  createDonation,
  updateDonation,
  updateDonationStatut,
  deleteDonation
};
