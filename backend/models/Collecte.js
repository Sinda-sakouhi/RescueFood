const mongoose = require('mongoose');

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

const collecteSchema = new mongoose.Schema(
  {
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true,
      unique: true
    },
    transporteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
      enum: ['PLANIFIEE', 'EN_ROUTE', 'COLLECTEE', 'LIVREE', 'ANNULEE'],
      default: 'PLANIFIEE'
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
    dateLivraison: {
      type: Date,
      default: null
    },
    itineraireOptimise: {
      type: itineraireSchema,
      default: undefined
    }
  },
  { timestamps: true }
);

collecteSchema.index({ transporteur: 1, statut: 1 });
collecteSchema.index({ dateCollectePrevue: 1 });

module.exports = mongoose.model('Collecte', collecteSchema);
