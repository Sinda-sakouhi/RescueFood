const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Annonce = require('../models/Annonce');
const Matching = require('../models/Matching');
const Conversation = require('../models/Conversation');

function calculerDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculerScore(donation, demande) {
  const scoreCategorie = donation.categorieDonation.equals(demande.categorieDonation) ? 1 : 0;

  const locDon = donation.localisationCollecte;
  const locDem = demande.localisation;
  let scoreDistance = 0.5;
  let distanceKm = null;

  if (locDon?.latitude && locDon?.longitude && locDem?.latitude && locDem?.longitude) {
    const distance = calculerDistance(
      locDon.latitude, locDon.longitude,
      locDem.latitude, locDem.longitude
    );
    scoreDistance = Math.max(0, 1 - distance / 50);
    distanceKm = Math.round(distance * 10) / 10;
  }

  const qDon = donation.quantiteEstimee || 1;
  const qDem = demande.quantiteEstimee || 1;
  const scoreQuantite = Math.min(qDon, qDem) / Math.max(qDon, qDem);

  const niveaux = { FAIBLE: 1, MOYENNE: 2, ELEVEE: 3 };
  const urgenceDon = niveaux[donation.urgence] || 2;
  const urgenceDem = niveaux[demande.urgence] || 2;
  const scoreUrgence = 1 - Math.abs(urgenceDon - urgenceDem) / 2;

  const scoreGlobal =
    scoreCategorie * 0.4 +
    scoreDistance * 0.3 +
    scoreQuantite * 0.2 +
    scoreUrgence * 0.1;

  return {
    score: Math.round(scoreGlobal * 100) / 100,
    criteres: {
      categorie: scoreCategorie,
      distance: Math.round(scoreDistance * 100) / 100,
      quantite: Math.round(scoreQuantite * 100) / 100,
      urgence: Math.round(scoreUrgence * 100) / 100
    },
    distanceKm
  };
}

// GET /api/matchings/suggestions
// FOURNISSEUR voit ses donations matchées avec les DEMANDE actives
// ONG voit ses DEMANDE matchées avec les donations disponibles
async function getSuggestions(request, response, next) {
  try {
    const { role, _id: userId } = request.user;

    if (role !== 'FOURNISSEUR' && role !== 'ONG') {
      return response.status(403).json({
        message: 'Seuls les fournisseurs et ONG ont accès aux suggestions'
      });
    }

    let donations, demandes;

    if (role === 'FOURNISSEUR') {
      donations = await Donation.find({
        fournisseur: userId,
        statut: { $in: ['CREE', 'VALIDE'] }
      }).populate('categorieDonation', 'nom');

      demandes = await Annonce.find({
        type: 'DEMANDE',
        statut: 'ACTIVE'
      })
        .populate('auteur', 'nom prenom role')
        .populate('categorieDonation', 'nom');
    } else {
      demandes = await Annonce.find({
        auteur: userId,
        type: 'DEMANDE',
        statut: 'ACTIVE'
      }).populate('categorieDonation', 'nom');

      donations = await Donation.find({
        statut: { $in: ['CREE', 'VALIDE', 'EN_ATTENTE_VALIDATION'] },
        fournisseur: { $ne: userId }
      })
        .populate('fournisseur', 'nom prenom role')
        .populate('categorieDonation', 'nom');
    }

    if (!donations.length || !demandes.length) {
      return response.json({ suggestions: [] });
    }

    const suggestions = [];

    for (const donation of donations) {
      for (const demande of demandes) {
        // localisation optionnelle — score distance = 0.5 si absente

        const { score, criteres, distanceKm } = calculerScore(donation, demande);

        if (score > 0.3) {
          suggestions.push({
            donation: {
              _id: donation._id,
              titre: donation.titre,
              fournisseur: donation.fournisseur,
              categorieDonation: donation.categorieDonation,
              quantiteEstimee: donation.quantiteEstimee,
              unite: donation.unite,
              urgence: donation.urgence,
              poidsTotalKg: donation.poidsTotalKg,
              adresseCollecte: donation.adresseCollecte
            },
            demande: {
              _id: demande._id,
              titre: demande.titre,
              auteur: demande.auteur,
              categorieDonation: demande.categorieDonation,
              quantiteEstimee: demande.quantiteEstimee,
              unite: demande.unite,
              urgence: demande.urgence,
              adresse: demande.adresse
            },
            score,
            criteres,
            distanceKm
          });
        }
      }
    }

    suggestions.sort((a, b) => b.score - a.score);

    return response.json({ suggestions });
  } catch (error) {
    return next(error);
  }
}

// POST /api/matchings — accepter un matching donation ↔ demande
async function accepterMatching(request, response, next) {
  try {
    const { donationId, demandeId } = request.body;

    if (
      !mongoose.isValidObjectId(donationId) ||
      !mongoose.isValidObjectId(demandeId)
    ) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const [donation, demande] = await Promise.all([
      Donation.findById(donationId),
      Annonce.findById(demandeId)
    ]);

    if (!donation) return response.status(404).json({ message: 'Donation introuvable' });
    if (!demande) return response.status(404).json({ message: 'Annonce introuvable' });

    if (demande.type !== 'DEMANDE') {
      return response.status(400).json({ message: "L'annonce doit être de type DEMANDE" });
    }

    if (demande.statut !== 'ACTIVE') {
      return response.status(400).json({ message: "L'annonce DEMANDE doit être active" });
    }

    if (!['CREE', 'VALIDE'].includes(donation.statut)) {
      return response.status(400).json({ message: 'La donation doit être disponible (CREE ou VALIDE)' });
    }

    const estFournisseur = donation.fournisseur.equals(request.user._id);
    const estONG = demande.auteur.equals(request.user._id);

    if (!estFournisseur && !estONG) {
      return response.status(403).json({
        message: "Vous devez être l'auteur de la donation ou de la demande"
      });
    }

    const matchingExistant = await Matching.findOne({ donation: donationId, demande: demandeId });
    if (matchingExistant && matchingExistant.statut === 'ACCEPTE') {
      return response.status(409).json({ message: 'Un matching actif existe déjà' });
    }

    const { score, criteres, distanceKm } = calculerScore(donation, demande);

    const matching = await Matching.findOneAndUpdate(
      { donation: donationId, demande: demandeId },
      {
        donation: donationId,
        demande: demandeId,
        score,
        criteres,
        distanceKm,
        statut: 'ACCEPTE',
        expireLe: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    // Donation → RESERVE, Annonce DEMANDE → MATCHEE
    await Promise.all([
      Donation.findByIdAndUpdate(donationId, { statut: 'RESERVE' }),
      Annonce.findByIdAndUpdate(demandeId, {
        $set: { statut: 'MATCHEE' },
        $push: { historiqueStatuts: { statut: 'MATCHEE', date: new Date() } }
      })
    ]);

    // Créer la conversation entre fournisseur et ONG
    const convExistante = await Conversation.findOne({ matching: matching._id });
    let conversation = convExistante;

    if (!convExistante) {
      conversation = await Conversation.create({
        participants: [donation.fournisseur, demande.auteur],
        annonce: demande._id,
        matching: matching._id,
        statut: 'ACTIVE',
        dernierMessageAt: new Date()
      });
    }

    return response.status(201).json({
      message: 'Matching accepté — conversation créée automatiquement',
      matching,
      conversation: {
        id: conversation._id,
        participants: conversation.participants,
        annonce: conversation.annonce,
        statut: conversation.statut
      }
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/matchings
async function listMatchings(request, response, next) {
  try {
    const { role, _id: userId } = request.user;

    let matchings;

    if (role === 'FOURNISSEUR') {
      const mesDonations = await Donation.find({ fournisseur: userId }).select('_id');
      const ids = mesDonations.map((d) => d._id);
      matchings = await Matching.find({ donation: { $in: ids } })
        .populate('donation', 'titre fournisseur quantiteEstimee unite urgence')
        .populate('demande', 'titre auteur quantiteEstimee unite urgence')
        .sort({ score: -1 });
    } else if (role === 'ONG') {
      const mesDemandes = await Annonce.find({ auteur: userId, type: 'DEMANDE' }).select('_id');
      const ids = mesDemandes.map((a) => a._id);
      matchings = await Matching.find({ demande: { $in: ids } })
        .populate('donation', 'titre fournisseur quantiteEstimee unite urgence')
        .populate('demande', 'titre auteur quantiteEstimee unite urgence')
        .sort({ score: -1 });
    } else {
      matchings = await Matching.find()
        .populate('donation', 'titre fournisseur quantiteEstimee unite urgence')
        .populate('demande', 'titre auteur quantiteEstimee unite urgence')
        .sort({ score: -1 });
    }

    return response.json({ matchings });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/matchings/:id/refuser
async function refuserMatching(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const matching = await Matching.findById(request.params.id)
      .populate('donation')
      .populate('demande');

    if (!matching) return response.status(404).json({ message: 'Matching introuvable' });

    const estFournisseur = matching.donation.fournisseur.equals(request.user._id);
    const estONG = matching.demande.auteur.equals(request.user._id);

    if (!estFournisseur && !estONG) {
      return response.status(403).json({ message: 'Vous ne pouvez pas refuser ce matching' });
    }

    matching.statut = 'REFUSE';
    await matching.save();

    await Promise.all([
      Donation.findByIdAndUpdate(matching.donation._id, { statut: 'VALIDE' }),
      Annonce.findByIdAndUpdate(matching.demande._id, {
        $set: { statut: 'ACTIVE' },
        $push: { historiqueStatuts: { statut: 'ACTIVE', date: new Date() } }
      })
    ]);

    return response.json({ message: 'Matching refusé — donation et demande remises en disponible' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSuggestions,
  accepterMatching,
  listMatchings,
  refuserMatching
};
