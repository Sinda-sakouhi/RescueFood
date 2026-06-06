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

const donationSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    fournisseur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    beneficiaire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    matchingSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Matching',
      default: null
    },
    categorieDonation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CategorieDonation',
      required: true
    },
    compositionLot: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    quantiteEstimee: {
      type: Number,
      required: true,
      min: 0.01
    },
    unite: {
      type: String,
      enum: ['KG', 'G', 'L', 'UNITE', 'PORTION'],
      required: true
    },
    poidsTotalKg: {
      type: Number,
      required: true,
      min: 0
    },
    images: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      validate: {
        validator: (images) => images.length > 0,
        message: 'Une donation doit contenir au moins une image du lot'
      },
      required: true
    },
    temperatureStockage: {
      type: Number,
      min: -30,
      max: 100,
      default: null
    },
    conditionsStockage: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    statut: {
      type: String,
      enum: [
        'CREE',
        'EN_ATTENTE_VALIDATION',
        'VALIDE',
        'RESERVE',
        'EN_COLLECTE',
        'LIVRE',
        'ANNULE'
      ],
      default: 'CREE'
    },
    urgence: {
      type: String,
      enum: ['FAIBLE', 'MOYENNE', 'ELEVEE'],
      default: 'MOYENNE'
    },
    dateDisponibilite: {
      type: Date,
      required: true
    },
    dateLimiteCollecte: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.dateDisponibilite || value >= this.dateDisponibilite;
        },
        message:
          'La date limite doit être postérieure à la date de disponibilité'
      }
    },
    adresseCollecte: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    localisationCollecte: {
      type: localisationSchema,
      required: true
    }
  },
  { timestamps: true }
);

donationSchema.index({ statut: 1, urgence: 1 });
donationSchema.index({ fournisseur: 1, createdAt: -1 });
donationSchema.index({ beneficiaire: 1, statut: 1 });
donationSchema.index({ categorieDonation: 1, dateLimiteCollecte: 1 });
donationSchema.index({ matchingSource: 1 }, { sparse: true });

module.exports = mongoose.model('Donation', donationSchema);
