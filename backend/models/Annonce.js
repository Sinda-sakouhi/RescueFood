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

const historiqueStatutSchema = new mongoose.Schema(
  {
    statut: {
      type: String,
      enum: ['ACTIVE', 'MATCHEE', 'CLOTUREE', 'ANNULEE', 'EXPIREE'],
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const annonceSchema = new mongoose.Schema(
  {
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['OFFRE', 'DEMANDE'],
      required: true
    },
    titre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    categorieDonation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CategorieDonation',
      required: true
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
    urgence: {
      type: String,
      enum: ['FAIBLE', 'MOYENNE', 'ELEVEE'],
      default: 'MOYENNE'
    },
    images: {
      type: [{ type: String, trim: true }],
      default: []
    },
    adresse: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    localisation: {
      type: localisationSchema,
      required: true
    },
    prixPromo: {
      type: Number,
      default: null,
      min: 0
    },
    dateExpiration: {
      type: Date,
      required: true
    },
    statut: {
      type: String,
      enum: ['ACTIVE', 'MATCHEE', 'CLOTUREE', 'ANNULEE', 'EXPIREE'],
      default: 'ACTIVE'
    },
    historiqueStatuts: {
      type: [historiqueStatutSchema],
      default: () => [{ statut: 'ACTIVE', date: new Date() }]
    }
  },
  { timestamps: true }
);

annonceSchema.index({ type: 1, statut: 1, categorieDonation: 1 });
annonceSchema.index({ auteur: 1, createdAt: -1 });
annonceSchema.index({ dateExpiration: 1, statut: 1 });
annonceSchema.index({
  'localisation.latitude': 1,
  'localisation.longitude': 1
});

module.exports = mongoose.model('Annonce', annonceSchema);
