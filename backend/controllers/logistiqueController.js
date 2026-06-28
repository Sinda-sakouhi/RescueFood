const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Collecte = require('../models/Collecte');
const Donation = require('../models/Donation');
const User = require('../models/User');
const {
  peutTransitionner,
  prochainsStatuts,
  calculerDistanceKm,
  estimerDureeMinutes
} = require('../utils/logistique');
const {
  construireContexteTunisien,
  evaluerPrioriteAlimentaire,
  optimiserOrdreCollectes,
  optimiserItineraireRoutierML,
  evaluerRisqueRetard,
  predireDureeCollecteML,
  predireRetardML,
  scorerTransporteur
} = require('../utils/logistiqueIA');

const STATUTS = [
  'A_ASSIGNER',
  'PLANIFIEE',
  'EN_ROUTE',
  'COLLECTEE',
  'LIVREE',
  'ANNULEE'
];

const populateCollecte = [
  {
    path: 'donation',
    select: 'titre poidsTotalKg quantiteEstimee unite urgence statut'
  },
  {
    path: 'transporteur',
    select: 'nom prenom telephone email localisation'
  },
  {
    path: 'fournisseur',
    select: 'nom prenom telephone adresse localisation'
  },
  {
    path: 'beneficiaire',
    select: 'nom prenom telephone adresse localisation'
  }
];

const populateDonationML = {
  path: 'donation',
  select:
    'titre description urgence dateLimiteCollecte temperatureStockage conditionsStockage categorieDonation',
  populate: {
    path: 'categorieDonation',
    select: 'nom typeProduit prioriteRedistribution dureeConservationEstimee'
  }
};

/**
 * Construit le filtre MongoDB correspondant au rôle connecté.
 * L'administrateur voit tout, tandis que chaque acteur ne voit que les
 * collectes auxquelles il participe.
 *
 * @param {object} user Utilisateur authentifié ajouté par le middleware.
 * @returns {object} Filtre à fusionner dans les requêtes sur les collectes.
 */
function scopeUtilisateur(user) {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'TRANSPORTEUR') return { transporteur: user._id };
  if (user.role === 'FOURNISSEUR') return { fournisseur: user._id };
  if (user.role === 'ONG') return { beneficiaire: user._id };
  return { _id: null };
}

/**
 * Vérifie qu'une valeur possède le format d'un ObjectId MongoDB.
 *
 * @param {string} id Identifiant reçu dans l'URL ou le corps HTTP.
 * @returns {boolean} Vrai lorsque l'identifiant peut être interrogé.
 */
function identifiantValide(id) {
  return mongoose.isValidObjectId(id);
}

/**
 * Génère une référence courte et lisible pour une nouvelle collecte.
 *
 * @returns {string} Référence au format COL-... utilisée dans l'interface.
 */
function construireReference() {
  return `COL-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

/**
 * Recherche une collecte en appliquant simultanément son identifiant et les
 * restrictions d'accès liées au rôle de l'utilisateur.
 *
 * @param {string} id Identifiant de la collecte.
 * @param {object} user Utilisateur authentifié.
 * @returns {Promise<object|null>} Collecte autorisée ou null.
 */
async function trouverCollecteAutorisee(id, user) {
  if (!identifiantValide(id)) return null;
  return Collecte.findOne({ _id: id, ...scopeUtilisateur(user) });
}

/**
 * Résume l'activité passée d'un transporteur pour alimenter les scores IA.
 * En l'absence d'historique, une ponctualité neutre de 80 % est utilisée.
 *
 * @param {object[]} collectes Historique des missions du transporteur.
 * @returns {object} Charge active, ponctualité et expérience de livraison.
 */
function calculerStatistiquesTransporteur(collectes) {
  const actives = collectes.filter(({ statut }) =>
    ['PLANIFIEE', 'EN_ROUTE', 'COLLECTEE'].includes(statut)
  ).length;
  const livraisonsEvaluees = collectes.filter(
    ({ statut, dateLivraison, dateLivraisonPrevue }) =>
      statut === 'LIVREE' && dateLivraison && dateLivraisonPrevue
  );
  const ponctuelles = livraisonsEvaluees.filter(
    ({ dateLivraison, dateLivraisonPrevue }) =>
      dateLivraison <= dateLivraisonPrevue
  ).length;

  return {
    collectesActives: actives,
    ponctualite: livraisonsEvaluees.length
      ? ponctuelles / livraisonsEvaluees.length
      : 0.8,
    livraisonsTerminees: collectes.filter(
      ({ statut }) => statut === 'LIVREE'
    ).length
  };
}

/**
 * Calcule les statistiques d'un transporteur pour une collecte donnée. La même
 * méthode alimente l'ancien scoring et le nouveau modèle ML.
 */
async function statistiquesPourCollecte(collecte) {
  if (!collecte.transporteur) {
    return {
      collectesActives: 0,
      ponctualite: 0.8,
      livraisonsTerminees: 0
    };
  }

  const historique = await Collecte.find({
    transporteur: collecte.transporteur
  }).select('statut dateLivraison dateLivraisonPrevue');

  return calculerStatistiquesTransporteur(historique);
}

/**
 * GET /api/logistique/collectes
 * Liste les collectes visibles par l'utilisateur avec recherche, filtres de
 * statut et de dates, pagination et transitions de statut possibles.
 */
async function listCollectes(request, response, next) {
  try {
    const {
      statut,
      recherche,
      page = '1',
      limite = '20',
      dateDebut,
      dateFin
    } = request.query;
    const filtre = { ...scopeUtilisateur(request.user) };

    if (statut && STATUTS.includes(statut)) filtre.statut = statut;
    if (dateDebut || dateFin) {
      filtre.dateCollectePrevue = {};
      if (dateDebut) filtre.dateCollectePrevue.$gte = new Date(dateDebut);
      if (dateFin) filtre.dateCollectePrevue.$lte = new Date(dateFin);
    }
    if (recherche) {
      const donations = await Donation.find({
        titre: { $regex: recherche, $options: 'i' }
      }).select('_id');
      filtre.$or = [
        { reference: { $regex: recherche, $options: 'i' } },
        { donation: { $in: donations.map(({ _id }) => _id) } }
      ];
    }

    const numeroPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const taillePage = Math.min(
      100,
      Math.max(1, Number.parseInt(limite, 10) || 20)
    );
    const [collectes, total] = await Promise.all([
      Collecte.find(filtre)
        .populate(populateCollecte)
        .sort({ dateCollectePrevue: 1 })
        .skip((numeroPage - 1) * taillePage)
        .limit(taillePage),
      Collecte.countDocuments(filtre)
    ]);

    return response.json({
      collectes: collectes.map((collecte) => ({
        ...collecte.toObject(),
        prochainsStatuts: prochainsStatuts(collecte.statut)
      })),
      pagination: {
        page: numeroPage,
        limite: taillePage,
        total,
        pages: Math.ceil(total / taillePage)
      }
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/collectes/:id
 * Retourne le détail d'une collecte uniquement si l'utilisateur connecté est
 * autorisé à la consulter.
 */
async function getCollecte(request, response, next) {
  try {
    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }

    await collecte.populate(populateCollecte);
    return response.json({
      collecte: {
        ...collecte.toObject(),
        prochainsStatuts: prochainsStatuts(collecte.statut)
      }
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/transporteurs
 * Liste les comptes transporteurs validés et calcule leur nombre de missions
 * actives afin d'aider l'administrateur à répartir la charge.
 */
async function listTransporteurs(request, response, next) {
  try {
    const [transporteurs, charges] = await Promise.all([
      User.find({ role: 'TRANSPORTEUR', statutCompte: 'VALIDE' }).select(
        'nom prenom email telephone localisation adresse'
      ),
      Collecte.aggregate([
        {
          $match: {
            transporteur: { $ne: null },
            statut: { $in: ['PLANIFIEE', 'EN_ROUTE', 'COLLECTEE'] }
          }
        },
        { $group: { _id: '$transporteur', collectesActives: { $sum: 1 } } }
      ])
    ]);
    const chargeParId = new Map(
      charges.map(({ _id, collectesActives }) => [
        _id.toString(),
        collectesActives
      ])
    );

    return response.json({
      transporteurs: transporteurs.map((transporteur) => ({
        ...transporteur.toObject(),
        collectesActives: chargeParId.get(transporteur.id) || 0
      }))
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/logistique/collectes
 * Transforme une donation validée ou réservée en mission logistique. La
 * distance, la durée, la priorité et le premier statut sont calculés ici.
 */
async function createCollecte(request, response, next) {
  try {
    const {
      donationId,
      dateCollectePrevue,
      dateLivraisonPrevue,
      transporteurId,
      vehicule = ''
    } = request.body;

    if (!identifiantValide(donationId) || !dateCollectePrevue) {
      return response.status(400).json({
        message: 'Donation et date de collecte obligatoires'
      });
    }

    const donation = await Donation.findById(donationId)
      .populate('fournisseur')
      .populate('beneficiaire');
    if (!donation) {
      return response.status(404).json({ message: 'Donation introuvable' });
    }
    if (!donation.beneficiaire) {
      return response.status(400).json({
        message: 'La donation doit avoir une ONG bénéficiaire'
      });
    }
    if (!['VALIDE', 'RESERVE'].includes(donation.statut)) {
      return response.status(409).json({
        message: 'Cette donation ne peut pas encore être planifiée'
      });
    }

    let transporteur = null;
    if (transporteurId) {
      if (!identifiantValide(transporteurId)) {
        return response.status(400).json({
          message: 'Identifiant transporteur invalide'
        });
      }
      transporteur = await User.findOne({
        _id: transporteurId,
        role: 'TRANSPORTEUR',
        statutCompte: 'VALIDE'
      });
      if (!transporteur) {
        return response.status(404).json({
          message: 'Transporteur disponible introuvable'
        });
      }
    }

    const depart = donation.localisationCollecte;
    const arrivee = donation.beneficiaire.localisation;
    if (!depart || !arrivee) {
      return response.status(400).json({
        message: 'Les coordonnées du fournisseur et de l’ONG sont obligatoires'
      });
    }

    const departBrut = depart.toObject ? depart.toObject() : depart;
    const arriveeBrute = arrivee.toObject ? arrivee.toObject() : arrivee;
    const distanceKm = calculerDistanceKm(departBrut, arriveeBrute);
    const statut = transporteur ? 'PLANIFIEE' : 'A_ASSIGNER';
    const collecte = await Collecte.create({
      reference: construireReference(),
      donation: donation._id,
      transporteur: transporteur?._id || null,
      fournisseur: donation.fournisseur._id,
      beneficiaire: donation.beneficiaire._id,
      statut,
      priorite: donation.urgence === 'ELEVEE' ? 'URGENTE' : 'NORMALE',
      adresseDepart: donation.adresseCollecte,
      adresseArrivee: donation.beneficiaire.adresse,
      localisationDepart: departBrut,
      localisationArrivee: arriveeBrute,
      distanceKm,
      dureeEstimeeMinutes: estimerDureeMinutes(distanceKm),
      dateCollectePrevue,
      dateLivraisonPrevue,
      vehicule,
      positionActuelle: departBrut,
      dernierePositionAt: new Date(),
      historiquePositions: [{ ...departBrut, enregistreeLe: new Date() }],
      historiqueStatuts: [
        {
          statut,
          modifiePar: request.user._id,
          note: transporteur
            ? 'Collecte créée et transporteur assigné'
            : 'Collecte en attente d’un transporteur'
        }
      ]
    });

    await collecte.populate(populateCollecte);
    return response.status(201).json({
      message: 'Collecte créée',
      collecte
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/logistique/collectes/:id/assignation
 * Associe un transporteur validé et son véhicule à une collecte encore
 * planifiable, puis place la mission au statut PLANIFIEE.
 */
async function assignerTransporteur(request, response, next) {
  try {
    const { transporteurId, vehicule = '' } = request.body;
    if (
      !identifiantValide(request.params.id) ||
      !identifiantValide(transporteurId)
    ) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const [collecte, transporteur] = await Promise.all([
      Collecte.findById(request.params.id),
      User.findOne({
        _id: transporteurId,
        role: 'TRANSPORTEUR',
        statutCompte: 'VALIDE'
      })
    ]);
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }
    if (!transporteur) {
      return response.status(404).json({
        message: 'Transporteur disponible introuvable'
      });
    }
    if (!['A_ASSIGNER', 'PLANIFIEE'].includes(collecte.statut)) {
      return response.status(409).json({
        message: 'Le transporteur ne peut plus être changé à cette étape'
      });
    }

    collecte.transporteur = transporteur._id;
    collecte.vehicule = vehicule;
    collecte.statut = 'PLANIFIEE';
    collecte.historiqueStatuts.push({
      statut: 'PLANIFIEE',
      modifiePar: request.user._id,
      note: `Transporteur assigné : ${transporteur.prenom} ${transporteur.nom}`
    });
    await collecte.save();
    await collecte.populate(populateCollecte);

    return response.json({ message: 'Transporteur assigné', collecte });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/logistique/collectes/:id/statut
 * Fait avancer la collecte dans le workflow autorisé, conserve une trace dans
 * l'historique et synchronise le statut de la donation correspondante.
 */
async function updateStatut(request, response, next) {
  try {
    const { statut, note = '' } = request.body;
    if (!STATUTS.includes(statut)) {
      return response.status(400).json({ message: 'Statut invalide' });
    }

    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }
    if (!peutTransitionner(collecte.statut, statut)) {
      return response.status(409).json({
        message: `Transition ${collecte.statut} vers ${statut} impossible`,
        prochainsStatuts: prochainsStatuts(collecte.statut)
      });
    }
    if (statut !== 'ANNULEE' && !collecte.transporteur) {
      return response.status(409).json({
        message: 'Un transporteur doit être assigné avant le départ'
      });
    }

    collecte.statut = statut;
    collecte.historiqueStatuts.push({
      statut,
      modifiePar: request.user._id,
      note
    });
    const maintenant = new Date();
    if (statut === 'EN_ROUTE' && !collecte.dateCollecteReelle) {
      collecte.dateCollecteReelle = maintenant;
    }
    if (statut === 'LIVREE') collecte.dateLivraison = maintenant;
    await collecte.save();

    const statutDonation = {
      EN_ROUTE: 'EN_COLLECTE',
      COLLECTEE: 'EN_COLLECTE',
      LIVREE: 'LIVRE',
      ANNULEE: 'VALIDE'
    }[statut];
    if (statutDonation) {
      await Donation.findByIdAndUpdate(collecte.donation, {
        statut: statutDonation
      });
    }

    await collecte.populate(populateCollecte);
    return response.json({
      message: 'Statut de la collecte mis à jour',
      collecte: {
        ...collecte.toObject(),
        prochainsStatuts: prochainsStatuts(collecte.statut)
      }
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/logistique/collectes/:id/position
 * Enregistre la position GPS courante pendant le transport et conserve les
 * 250 derniers points afin de permettre le suivi de la mission.
 */
async function updatePosition(request, response, next) {
  try {
    const { latitude, longitude } = request.body;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return response.status(400).json({
        message: 'Coordonnées GPS invalides'
      });
    }

    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }
    if (!['EN_ROUTE', 'COLLECTEE'].includes(collecte.statut)) {
      return response.status(409).json({
        message: 'Le suivi GPS est disponible pendant le transport'
      });
    }

    const maintenant = new Date();
    collecte.positionActuelle = { latitude, longitude };
    collecte.dernierePositionAt = maintenant;
    collecte.historiquePositions.push({
      latitude,
      longitude,
      enregistreeLe: maintenant
    });
    if (collecte.historiquePositions.length > 250) {
      collecte.historiquePositions = collecte.historiquePositions.slice(-250);
    }
    await collecte.save();

    return response.json({
      message: 'Position mise à jour',
      position: collecte.positionActuelle,
      dernierePositionAt: collecte.dernierePositionAt
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/logistique/ia/itineraire/optimiser
 * Sélectionne les missions actives d'un transporteur et délègue leur
 * classement à l'algorithme explicable de proximité, urgence et échéance.
 */
async function optimiserItineraire(request, response, next) {
  try {
    const transporteurId =
      request.user.role === 'TRANSPORTEUR'
        ? request.user._id
        : request.body.transporteurId;
    const { collecteIds, positionDepart } = request.body;

    if (!identifiantValide(transporteurId)) {
      return response.status(400).json({
        message: 'Un transporteur valide est requis'
      });
    }
    if (
      positionDepart &&
      (!Number.isFinite(positionDepart.latitude) ||
        !Number.isFinite(positionDepart.longitude))
    ) {
      return response.status(400).json({
        message: 'Position de départ invalide'
      });
    }

    const transporteur = await User.findOne({
      _id: transporteurId,
      role: 'TRANSPORTEUR',
      statutCompte: 'VALIDE'
    }).select('nom prenom localisation');
    if (!transporteur) {
      return response.status(404).json({
        message: 'Transporteur disponible introuvable'
      });
    }

    const filtre = {
      transporteur: transporteur._id,
      statut: { $in: ['PLANIFIEE', 'EN_ROUTE', 'COLLECTEE'] }
    };
    if (Array.isArray(collecteIds) && collecteIds.length) {
      if (collecteIds.some((id) => !identifiantValide(id))) {
        return response.status(400).json({
          message: 'Une collecte possède un identifiant invalide'
        });
      }
      filtre._id = { $in: collecteIds };
    }

    const collectes = await Collecte.find(filtre)
      .populate(populateDonationML)
      .sort({ dateCollectePrevue: 1 });
    if (!collectes.length) {
      return response.status(404).json({
        message: 'Aucune collecte active à optimiser pour ce transporteur'
      });
    }

    const positionInitiale =
      positionDepart ||
      transporteur.localisation ||
      collectes[0].positionActuelle ||
      collectes[0].localisationDepart;
    const resultat = optimiserOrdreCollectes(
      collectes.map((collecte) => collecte.toObject()),
      positionInitiale
    );

    return response.json({
      methode: 'Scoring glouton explicable',
      ponderations: {
        proximite: 0.45,
        urgence: 0.35,
        echeance: 0.2
      },
      transporteur: {
        id: transporteur.id,
        nom: `${transporteur.prenom} ${transporteur.nom}`
      },
      distanceInitialeKm: resultat.distanceInitialeKm,
      distanceOptimiseeKm: resultat.distanceOptimiseeKm,
      gainDistanceKm: resultat.gainDistanceKm,
      dureeEstimeeMinutes: resultat.dureeEstimeeMinutes,
      ordreOptimise: resultat.ordre.map(
        ({ collecte, score, criteres, distanceApprocheKm }, index) => ({
          ordre: index + 1,
          collecteId: collecte._id,
          reference: collecte.reference,
          titre: collecte.donation?.titre,
          score: Math.round(score * 100),
          distanceApprocheKm: Math.round(distanceApprocheKm * 10) / 10,
          criteres
        })
      )
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/logistique/ml/itineraire/optimiser
 * Optimise les missions actives avec OSRM lorsque le service routier répond,
 * puis ajoute une prédiction ML de durée pour chaque collecte.
 */
async function optimiserItineraireML(request, response, next) {
  try {
    const transporteurId =
      request.user.role === 'TRANSPORTEUR'
        ? request.user._id
        : request.body.transporteurId;
    const { collecteIds, positionDepart } = request.body;

    if (!identifiantValide(transporteurId)) {
      return response.status(400).json({
        message: 'Un transporteur valide est requis'
      });
    }
    if (
      positionDepart &&
      (!Number.isFinite(positionDepart.latitude) ||
        !Number.isFinite(positionDepart.longitude))
    ) {
      return response.status(400).json({
        message: 'Position de départ invalide'
      });
    }

    const transporteur = await User.findOne({
      _id: transporteurId,
      role: 'TRANSPORTEUR',
      statutCompte: 'VALIDE'
    }).select('nom prenom localisation');
    if (!transporteur) {
      return response.status(404).json({
        message: 'Transporteur disponible introuvable'
      });
    }

    const filtre = {
      transporteur: transporteur._id,
      statut: { $in: ['PLANIFIEE', 'EN_ROUTE', 'COLLECTEE'] }
    };
    if (Array.isArray(collecteIds) && collecteIds.length) {
      if (collecteIds.some((id) => !identifiantValide(id))) {
        return response.status(400).json({
          message: 'Une collecte possède un identifiant invalide'
        });
      }
      filtre._id = { $in: collecteIds };
    }

    const collectes = await Collecte.find(filtre)
      .populate(populateDonationML)
      .sort({ dateCollectePrevue: 1 });
    if (!collectes.length) {
      return response.status(404).json({
        message: 'Aucune collecte active à optimiser pour ce transporteur'
      });
    }

    const statistiques = calculerStatistiquesTransporteur(
      await Collecte.find({ transporteur: transporteur._id }).select(
        'statut dateLivraison dateLivraisonPrevue'
      )
    );
    const contextes = await Promise.all(
      collectes.map((collecte) =>
        construireContexteTunisien(collecte.toObject())
      )
    );
    const statistiquesParCollecte = new Map(
      collectes.map((collecte, index) => [
        collecte.id,
        {
          collectesActivesTransporteur: statistiques.collectesActives,
          ponctualiteTransporteur: statistiques.ponctualite,
          contexteTunisien: contextes[index]
        }
      ])
    );
    const positionInitiale =
      positionDepart ||
      transporteur.localisation ||
      collectes[0].positionActuelle ||
      collectes[0].localisationDepart;
    const resultat = await optimiserItineraireRoutierML(
      collectes.map((collecte) => collecte.toObject()),
      positionInitiale,
      { statistiquesParCollecte }
    );

    return response.json({
      methode: resultat.methode,
      sourceRouting: resultat.sourceRouting,
      raisonFallback: resultat.raisonFallback,
      modele: 'Regression lineaire locale v1',
      transporteur: {
        id: transporteur.id,
        nom: `${transporteur.prenom} ${transporteur.nom}`
      },
      distanceInitialeKm: resultat.distanceInitialeKm,
      distanceOptimiseeKm: resultat.distanceOptimiseeKm,
      gainDistanceKm: resultat.gainDistanceKm,
      dureeRouteMinutes: resultat.dureeRouteMinutes,
      polyline: resultat.polyline,
      ordreOptimise: resultat.ordreOptimise.map(
        ({
          ordre,
          collecte,
          prioriteAlimentaire,
          criteresOptimisation,
          dureePrediteMinutes,
          prediction
        }) => ({
          ordre,
          collecteId: collecte._id,
          reference: collecte.reference,
          titre: collecte.donation?.titre,
          prioriteAlimentaire,
          criteresOptimisation,
          dureePrediteMinutes,
          prediction
        })
      )
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/ia/collectes/:id/risque-retard
 * Évalue le risque de retard à partir de la mission, de la charge du
 * transporteur et de son historique de ponctualité.
 */
async function risqueRetard(request, response, next) {
  try {
    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }

    let statistiques = {
      collectesActives: 0,
      ponctualite: 0.8,
      livraisonsTerminees: 0
    };
    if (collecte.transporteur) {
      const historique = await Collecte.find({
        transporteur: collecte.transporteur
      }).select('statut dateLivraison dateLivraisonPrevue');
      statistiques = calculerStatistiquesTransporteur(historique);
    }

    const analyse = evaluerRisqueRetard(collecte.toObject(), {
      ponctualiteTransporteur: statistiques.ponctualite,
      collectesActivesTransporteur: statistiques.collectesActives
    });

    return response.json({
      collecteId: collecte.id,
      reference: collecte.reference,
      methode: 'Scoring de risque explicable',
      analyse,
      facteurs: {
        ponctualiteTransporteur: Math.round(statistiques.ponctualite * 100),
        collectesActivesTransporteur: statistiques.collectesActives,
        dureeEstimeeMinutes: collecte.dureeEstimeeMinutes,
        dateLivraisonPrevue: collecte.dateLivraisonPrevue
      }
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/ml/collectes/:id/contexte-tunisien
 * Expose les facteurs locaux utilisés par le modèle : zone, heure de pointe,
 * météo et pénalités appliquées.
 */
async function contexteTunisienML(request, response, next) {
  try {
    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }

    await collecte.populate(populateDonationML);
    const contexte = await construireContexteTunisien(collecte.toObject());

    return response.json({
      collecte: {
        id: collecte.id,
        reference: collecte.reference,
        titre: collecte.donation?.titre
      },
      contexte
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/ml/collectes/:id/duree-predite
 * Prédit la durée réelle d'une mission avec le modèle ML local. La durée de
 * base vient de la collecte et pourra être remplacée par OSRM dans l'itinéraire.
 */
async function dureePrediteML(request, response, next) {
  try {
    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }

    await collecte.populate(populateDonationML);
    const statistiques = await statistiquesPourCollecte(collecte);
    const contexteTunisien = await construireContexteTunisien(
      collecte.toObject()
    );
    const prediction = predireDureeCollecteML(collecte.toObject(), {
      collectesActivesTransporteur: statistiques.collectesActives,
      ponctualiteTransporteur: statistiques.ponctualite,
      contexteTunisien
    });

    return response.json({
      collecte: {
        id: collecte.id,
        reference: collecte.reference,
        titre: collecte.donation?.titre
      },
      prioriteAlimentaire: evaluerPrioriteAlimentaire(collecte.toObject()),
      prediction
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/ml/collectes/:id/retard-predit
 * Convertit la durée prédite en probabilité de retard exploitable par le
 * dashboard et par le transporteur.
 */
async function retardPreditML(request, response, next) {
  try {
    const collecte = await trouverCollecteAutorisee(
      request.params.id,
      request.user
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }

    await collecte.populate(populateDonationML);
    const statistiques = await statistiquesPourCollecte(collecte);
    const contexteTunisien = await construireContexteTunisien(
      collecte.toObject()
    );
    const prediction = predireRetardML(collecte.toObject(), {
      collectesActivesTransporteur: statistiques.collectesActives,
      ponctualiteTransporteur: statistiques.ponctualite,
      contexteTunisien
    });

    return response.json({
      collecte: {
        id: collecte.id,
        reference: collecte.reference,
        titre: collecte.donation?.titre
      },
      prioriteAlimentaire: evaluerPrioriteAlimentaire(collecte.toObject()),
      prediction
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/ia/collectes/:id/transporteurs-recommandes
 * Calcule un score explicable pour chaque transporteur validé et retourne le
 * classement du candidat le plus adapté au moins adapté.
 */
async function recommanderTransporteurs(request, response, next) {
  try {
    if (!identifiantValide(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }
    const collecte = await Collecte.findById(request.params.id).populate(
      'donation',
      'titre urgence'
    );
    if (!collecte) {
      return response.status(404).json({ message: 'Collecte introuvable' });
    }
    if (!['A_ASSIGNER', 'PLANIFIEE'].includes(collecte.statut)) {
      return response.status(409).json({
        message: 'La recommandation est réservée aux collectes à planifier'
      });
    }

    const transporteurs = await User.find({
      role: 'TRANSPORTEUR',
      statutCompte: 'VALIDE'
    }).select('nom prenom email telephone localisation adresse');
    const ids = transporteurs.map(({ _id }) => _id);
    const historique = await Collecte.find({
      transporteur: { $in: ids }
    }).select(
      'transporteur statut dateLivraison dateLivraisonPrevue'
    );
    const historiqueParTransporteur = new Map();
    for (const mission of historique) {
      const id = mission.transporteur?.toString();
      if (!id) continue;
      if (!historiqueParTransporteur.has(id)) {
        historiqueParTransporteur.set(id, []);
      }
      historiqueParTransporteur.get(id).push(mission);
    }

    const recommandations = transporteurs
      .map((transporteur) => {
        const statistiques = calculerStatistiquesTransporteur(
          historiqueParTransporteur.get(transporteur.id) || []
        );
        const analyse = scorerTransporteur(
          transporteur.toObject(),
          collecte.toObject(),
          statistiques
        );
        return {
          transporteur: {
            id: transporteur.id,
            nom: `${transporteur.prenom} ${transporteur.nom}`,
            email: transporteur.email,
            telephone: transporteur.telephone
          },
          ...analyse
        };
      })
      .sort((a, b) => b.score - a.score);

    return response.json({
      collecte: {
        id: collecte.id,
        reference: collecte.reference,
        titre: collecte.donation?.titre
      },
      methode: 'Classement multicritère explicable',
      ponderations: {
        proximite: 0.35,
        disponibilite: 0.3,
        ponctualite: 0.25,
        experience: 0.1
      },
      recommandations
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/dashboard
 * Agrège les collectes accessibles en KPIs, activité des sept derniers jours
 * et alertes opérationnelles pour alimenter le tableau de bord.
 */
async function dashboard(request, response, next) {
  try {
    const collectes = await Collecte.find(scopeUtilisateur(request.user))
      .populate('donation', 'poidsTotalKg titre urgence')
      .sort({ dateCollectePrevue: 1 });
    const maintenant = new Date();
    const parStatut = Object.fromEntries(STATUTS.map((statut) => [statut, 0]));
    const activite = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return { date: date.toISOString().slice(0, 10), livraisons: 0 };
    });
    let poidsLivreKg = 0;
    let dureeTotaleMinutes = 0;
    let livraisonsChronometrees = 0;
    let livraisonsPonctuelles = 0;
    let livraisonsAvecPrevision = 0;

    for (const collecte of collectes) {
      parStatut[collecte.statut] += 1;
      if (collecte.statut !== 'LIVREE') continue;

      poidsLivreKg += collecte.donation?.poidsTotalKg || 0;
      if (collecte.dateCollecteReelle && collecte.dateLivraison) {
        dureeTotaleMinutes +=
          (collecte.dateLivraison - collecte.dateCollecteReelle) / 60000;
        livraisonsChronometrees += 1;
      }
      if (collecte.dateLivraisonPrevue && collecte.dateLivraison) {
        livraisonsAvecPrevision += 1;
        if (collecte.dateLivraison <= collecte.dateLivraisonPrevue) {
          livraisonsPonctuelles += 1;
        }
      }
      const jour = collecte.dateLivraison?.toISOString().slice(0, 10);
      const point = activite.find(({ date }) => date === jour);
      if (point) point.livraisons += 1;
    }

    const alertes = collectes
      .filter((collecte) => {
        const retard =
          !['LIVREE', 'ANNULEE'].includes(collecte.statut) &&
          collecte.dateCollectePrevue < maintenant;
        return collecte.statut === 'A_ASSIGNER' || retard;
      })
      .slice(0, 6)
      .map((collecte) => ({
        id: collecte.id,
        niveau:
          collecte.statut === 'A_ASSIGNER' ? 'ATTENTION' : 'CRITIQUE',
        titre:
          collecte.statut === 'A_ASSIGNER'
            ? 'Transporteur à assigner'
            : 'Collecte en retard',
        message: `${collecte.reference || 'Collecte'} · ${
          collecte.donation?.titre || 'Donation'
        }`
      }));

    return response.json({
      kpis: {
        collectesTotal: collectes.length,
        collectesActives:
          parStatut.PLANIFIEE + parStatut.EN_ROUTE + parStatut.COLLECTEE,
        livraisonsTerminees: parStatut.LIVREE,
        poidsLivreKg: Math.round(poidsLivreKg * 10) / 10,
        dureeMoyenneMinutes: livraisonsChronometrees
          ? Math.round(dureeTotaleMinutes / livraisonsChronometrees)
          : 0,
        tauxPonctualite: livraisonsAvecPrevision
          ? Math.round(
              (livraisonsPonctuelles / livraisonsAvecPrevision) * 100
            )
          : 100
      },
      parStatut,
      activite,
      alertes
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/carte
 * Prépare une représentation légère des trajets, positions et transporteurs
 * que le frontend peut directement afficher sur une carte.
 */
async function carte(request, response, next) {
  try {
    const collectes = await Collecte.find({
      ...scopeUtilisateur(request.user),
      statut: { $ne: 'ANNULEE' }
    })
      .populate('donation', 'titre urgence')
      .populate('transporteur', 'nom prenom')
      .sort({ dateCollectePrevue: 1 });

    return response.json({
      points: collectes.map((collecte) => ({
        id: collecte.id,
        reference: collecte.reference,
        titre: collecte.donation?.titre,
        urgence: collecte.donation?.urgence,
        statut: collecte.statut,
        depart: {
          adresse: collecte.adresseDepart,
          ...collecte.localisationDepart.toObject()
        },
        arrivee: {
          adresse: collecte.adresseArrivee,
          ...collecte.localisationArrivee.toObject()
        },
        positionActuelle: collecte.positionActuelle,
        transporteur: collecte.transporteur
          ? `${collecte.transporteur.prenom} ${collecte.transporteur.nom}`
          : null
      }))
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/logistique/rapport.pdf
 * Génère à la volée un rapport PDF des cent dernières collectes accessibles
 * et l'envoie directement dans la réponse HTTP.
 */
async function rapportPdf(request, response, next) {
  try {
    const collectes = await Collecte.find(scopeUtilisateur(request.user))
      .populate('donation', 'titre poidsTotalKg')
      .populate('transporteur', 'nom prenom')
      .sort({ dateCollectePrevue: -1 })
      .limit(100);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-logistique-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf"`
    );
    const document = new PDFDocument({ margin: 48, size: 'A4' });
    document.pipe(response);
    document
      .fillColor('#173e2a')
      .fontSize(24)
      .text('RescueFood', { continued: true })
      .fillColor('#6b7f76')
      .fontSize(12)
      .text('  Rapport logistique');
    document.moveDown(0.5);
    document
      .fillColor('#52665d')
      .fontSize(10)
      .text(`Généré le ${new Date().toLocaleString('fr-FR')}`);
    document.moveDown(1.5);

    const livrees = collectes.filter(({ statut }) => statut === 'LIVREE');
    const poids = livrees.reduce(
      (total, collecte) => total + (collecte.donation?.poidsTotalKg || 0),
      0
    );
    document
      .fillColor('#173e2a')
      .fontSize(14)
      .text(
        `${collectes.length} collectes · ${livrees.length} livrées · ${poids.toFixed(
          1
        )} kg redistribués`
      );
    document.moveDown();

    for (const collecte of collectes) {
      if (document.y > 730) document.addPage();
      document
        .fillColor('#173e2a')
        .fontSize(11)
        .text(
          `${collecte.reference || 'Sans référence'} · ${
            collecte.donation?.titre || 'Donation'
          }`
        );
      document
        .fillColor('#60736a')
        .fontSize(9)
        .text(
          `${collecte.statut} | ${collecte.distanceKm} km | ${
            collecte.transporteur
              ? `${collecte.transporteur.prenom} ${collecte.transporteur.nom}`
              : 'Non assignée'
          }`
        );
      document.moveDown(0.7);
    }
    document.end();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCollectes,
  getCollecte,
  listTransporteurs,
  createCollecte,
  assignerTransporteur,
  updateStatut,
  updatePosition,
  optimiserItineraire,
  optimiserItineraireML,
  risqueRetard,
  contexteTunisienML,
  dureePrediteML,
  retardPreditML,
  recommanderTransporteurs,
  dashboard,
  carte,
  rapportPdf
};
