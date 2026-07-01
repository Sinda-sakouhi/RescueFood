const mongoose = require('mongoose');

// Structure réutilisable pour valider toutes les coordonnées GPS du module.
const localisationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  { _id: false }
);

// Résultat optionnel d'une optimisation d'itinéraire persistée en base.
const itineraireSchema = new mongoose.Schema(
  {
    polyline: {
      type: String,
      trim: true,
      default: null
    },
    scoreOptimisation: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    }
  },
  { _id: false }
);

// Point GPS horodaté utilisé dans l'historique de suivi d'une mission.
const positionSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    enregistreeLe: { type: Date, default: Date.now }
  },
  { _id: false }
);

// Trace chaque changement de statut, son auteur et une éventuelle justification.
const historiqueStatutSchema = new mongoose.Schema(
  {
    statut: { type: String, required: true },
    date: { type: Date, default: Date.now },
    modifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    note: { type: String, trim: true, maxlength: 500, default: '' }
  },
  { _id: false }
);

// Document central du module : une collecte relie une donation, son fournisseur,
// son ONG bénéficiaire, un transporteur et toutes les données du trajet.
const collecteSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true
    },
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      unique: true
    },
    transporteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    fournisseur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    beneficiaire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    statut: {
      type: String,
      enum: [
        'A_ASSIGNER',
        'PLANIFIEE',
        'EN_ROUTE',
        'COLLECTEE',
        'LIVREE',
        'ANNULEE'
      ],
      default: 'A_ASSIGNER'
    },
    priorite: {
      type: String,
      enum: ['NORMALE', 'URGENTE'],
      default: 'NORMALE'
    },
    adresseDepart: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    adresseArrivee: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    localisationDepart: {
      type: localisationSchema,
      required: true
    },
    localisationArrivee: {
      type: localisationSchema,
      required: true
    },
    distanceKm: {
      type: Number,
      min: 0,
      default: 0
    },
    dureeEstimeeMinutes: {
      type: Number,
      min: 0,
      default: 0
    },
    dateCollectePrevue: {
      type: Date,
      required: true
    },
    dateCollecteReelle: {
      type: Date,
      default: null
    },
    dateLivraisonPrevue: {
      type: Date,
      default: null
    },
    dateLivraison: {
      type: Date,
      default: null
    },
    vehicule: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ''
    },
    positionActuelle: {
      type: localisationSchema,
      default: undefined
    },
    dernierePositionAt: {
      type: Date,
      default: null
    },
    historiquePositions: {
      type: [positionSchema],
      default: []
    },
    historiqueStatuts: {
      type: [historiqueStatutSchema],
      default: []
    },
    itineraireOptimise: {
      type: itineraireSchema,
      default: undefined
    }
  },
  { timestamps: true }
);

// Ces index accélèrent les vues transporteur, les dashboards et les tris par date.
collecteSchema.index({ transporteur: 1, statut: 1 });
collecteSchema.index({ dateCollectePrevue: 1 });
collecteSchema.index({ statut: 1, dateCollectePrevue: 1 });

module.exports = mongoose.model('Collecte', collecteSchema);
