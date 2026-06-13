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
  optimiserOrdreCollectes,
  evaluerRisqueRetard,
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

function scopeUtilisateur(user) {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'TRANSPORTEUR') return { transporteur: user._id };
  if (user.role === 'FOURNISSEUR') return { fournisseur: user._id };
  if (user.role === 'ONG') return { beneficiaire: user._id };
  return { _id: null };
}

function identifiantValide(id) {
  return mongoose.isValidObjectId(id);
}

function construireReference() {
  return `COL-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

async function trouverCollecteAutorisee(id, user) {
  if (!identifiantValide(id)) return null;
  return Collecte.findOne({ _id: id, ...scopeUtilisateur(user) });
}

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
      .populate('donation', 'titre urgence dateLimiteCollecte')
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
  risqueRetard,
  recommanderTransporteurs,
  dashboard,
  carte,
  rapportPdf
};
