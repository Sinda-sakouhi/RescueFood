const mongoose = require('mongoose');
const Annonce = require('../models/Annonce');
const Matching = require('../models/Matching');
const Conversation = require('../models/Conversation');

// Calcule la distance en km entre deux points GPS (formule Haversine)
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

// Calcule le score de matching entre une offre et une demande
function calculerScore(offre, demande) {
  // Score catégorie (1 si même catégorie, 0 sinon)
  const scoreCategorie = offre.categorieDonation.equals(
    demande.categorieDonation
  )
    ? 1
    : 0;

  // Score distance (1 si < 2km, dégressif jusqu'à 0 à 50km)
  const distance = calculerDistance(
    offre.localisation.latitude,
    offre.localisation.longitude,
    demande.localisation.latitude,
    demande.localisation.longitude
  );
  const scoreDistance = Math.max(0, 1 - distance / 50);

  // Score quantité (ratio entre min et max des deux quantités)
  const scoreQuantite =
    Math.min(offre.quantiteEstimee, demande.quantiteEstimee) /
    Math.max(offre.quantiteEstimee, demande.quantiteEstimee);

  // Score urgence
  const niveaux = { FAIBLE: 1, MOYENNE: 2, ELEVEE: 3 };
  const urgenceOffre = niveaux[offre.urgence] || 2;
  const urgenceDemande = niveaux[demande.urgence] || 2;
  const scoreUrgence = 1 - Math.abs(urgenceOffre - urgenceDemande) / 2;

  // Score global pondéré
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
    distanceKm: Math.round(distance * 10) / 10
  };
}

// GET /api/matchings/suggestions
async function getSuggestions(request, response, next) {
  try {
    const role = request.user.role;

    if (role !== 'FOURNISSEUR' && role !== 'ONG') {
      return response.status(403).json({
        message: 'Seuls les fournisseurs et ONG ont accès aux suggestions'
      });
    }

    const typeRecherche = role === 'FOURNISSEUR' ? 'OFFRE' : 'DEMANDE';
    const typeCompatible = role === 'FOURNISSEUR' ? 'DEMANDE' : 'OFFRE';

    const mesAnnonces = await Annonce.find({
      auteur: request.user._id,
      type: typeRecherche,
      statut: 'ACTIVE'
    });

    if (mesAnnonces.length === 0) {
      return response.json({
        message: 'Aucune annonce active trouvée',
        suggestions: []
      });
    }

    const annoncesCompatibles = await Annonce.find({
      type: typeCompatible,
      statut: 'ACTIVE',
      auteur: { $ne: request.user._id }
    }).populate('auteur', 'nom prenom role adresse');

    const suggestions = [];

    for (const monAnnonce of mesAnnonces) {
      for (const annonce of annoncesCompatibles) {
        const { score, criteres, distanceKm } = calculerScore(
          typeRecherche === 'OFFRE' ? monAnnonce : annonce,
          typeRecherche === 'OFFRE' ? annonce : monAnnonce
        );

        if (score > 0.3) {
          suggestions.push({
            monAnnonce: {
              id: monAnnonce._id,
              titre: monAnnonce.titre,
              type: monAnnonce.type
            },
            annonceCompatible: {
              id: annonce._id,
              titre: annonce.titre,
              type: annonce.type,
              auteur: annonce.auteur
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

// POST /api/matchings — accepter un matching
// → crée le matching ET la conversation automatiquement
async function accepterMatching(request, response, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { offreId, demandeId } = request.body;

    if (
      !mongoose.isValidObjectId(offreId) ||
      !mongoose.isValidObjectId(demandeId)
    ) {
      await session.abortTransaction();
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const [offre, demande] = await Promise.all([
      Annonce.findById(offreId).session(session),
      Annonce.findById(demandeId).session(session)
    ]);

    if (!offre || !demande) {
      await session.abortTransaction();
      return response.status(404).json({ message: 'Annonce introuvable' });
    }

    if (offre.type !== 'OFFRE' || demande.type !== 'DEMANDE') {
      await session.abortTransaction();
      return response.status(400).json({
        message: 'Le premier identifiant doit être une offre et le second une demande'
      });
    }

    if (offre.statut !== 'ACTIVE' || demande.statut !== 'ACTIVE') {
      await session.abortTransaction();
      return response.status(400).json({
        message: 'Les deux annonces doivent être actives'
      });
    }

    // Vérifier que l'utilisateur est l'auteur de l'une des deux annonces
    const estAuteur =
      offre.auteur.equals(request.user._id) ||
      demande.auteur.equals(request.user._id);

    if (!estAuteur) {
      await session.abortTransaction();
      return response.status(403).json({
        message: 'Vous devez être l\'auteur d\'une des deux annonces'
      });
    }

    // Vérifier si un matching existe déjà
    const matchingExistant = await Matching.findOne({
      offre: offreId,
      demande: demandeId
    }).session(session);

    if (matchingExistant && matchingExistant.statut === 'ACCEPTE') {
      await session.abortTransaction();
      return response.status(409).json({
        message: 'Un matching actif existe déjà entre ces deux annonces'
      });
    }

    // Calculer le score
    const { score, criteres, distanceKm } = calculerScore(offre, demande);

    // 1. Créer ou mettre à jour le matching
    const matching = await Matching.findOneAndUpdate(
      { offre: offreId, demande: demandeId },
      {
        offre: offreId,
        demande: demandeId,
        score,
        criteres,
        distanceKm,
        statut: 'ACCEPTE',
        expireLe: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
        session
      }
    );

    // 2. Mettre à jour le statut des deux annonces → MATCHEE
    await Annonce.updateMany(
      { _id: { $in: [offreId, demandeId] } },
      {
        $set: { statut: 'MATCHEE' },
        $push: {
          historiqueStatuts: {
            statut: 'MATCHEE',
            date: new Date()
          }
        }
      },
      { session }
    );

    // 3. Créer la conversation automatiquement
    // Vérifier si une conversation existe déjà pour ce matching
    const convExistante = await Conversation.findOne({
      matching: matching._id
    }).session(session);

    let conversation = convExistante;

    if (!convExistante) {
      const [nouvelleConv] = await Conversation.create(
        [
          {
            participants: [offre.auteur, demande.auteur],
            annonce: offre._id,
            matching: matching._id,
            statut: 'ACTIVE',
            dernierMessageAt: new Date()
          }
        ],
        { session }
      );
      conversation = nouvelleConv;
    }

    await session.commitTransaction();

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
    await session.abortTransaction();
    return next(error);
  } finally {
    session.endSession();
  }
}

// GET /api/matchings — liste des matchings de l'utilisateur
async function listMatchings(request, response, next) {
  try {
    const mesAnnonces = await Annonce.find({
      auteur: request.user._id
    }).select('_id');

    const ids = mesAnnonces.map((a) => a._id);

    const matchings = await Matching.find({
      $or: [
        { offre: { $in: ids } },
        { demande: { $in: ids } }
      ]
    })
      .populate('offre', 'titre type auteur quantiteEstimee unite')
      .populate('demande', 'titre type auteur quantiteEstimee unite')
      .sort({ score: -1 });

    return response.json({ matchings });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/matchings/:id/refuser — refuser un matching
async function refuserMatching(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const matching = await Matching.findById(request.params.id)
      .populate('offre')
      .populate('demande');

    if (!matching) {
      return response.status(404).json({ message: 'Matching introuvable' });
    }

    // Vérifier que l'utilisateur est auteur d'une des annonces
    const estAuteur =
      matching.offre.auteur.equals(request.user._id) ||
      matching.demande.auteur.equals(request.user._id);

    if (!estAuteur) {
      return response.status(403).json({
        message: 'Vous ne pouvez pas refuser ce matching'
      });
    }

    matching.statut = 'REFUSE';
    await matching.save();

    // Remettre les annonces en ACTIVE
    await Annonce.updateMany(
      { _id: { $in: [matching.offre._id, matching.demande._id] } },
      {
        $set: { statut: 'ACTIVE' },
        $push: {
          historiqueStatuts: {
            statut: 'ACTIVE',
            date: new Date()
          }
        }
      }
    );

    return response.json({ message: 'Matching refusé — annonces remises en actif' });
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