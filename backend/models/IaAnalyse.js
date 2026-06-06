const mongoose = require('mongoose');

const elementDetecteSchema = new mongoose.Schema(
  {
    categorie: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    quantiteEstimee: {
      type: Number,
      min: 0,
      default: null
    },
    fraicheur: {
      type: String,
      enum: [
        'EXCELLENT',
        'BON',
        'MOYEN',
        'A_CONSOMMER_RAPIDEMENT',
        'NON_CONFORME'
      ],
      required: true
    },
    defautsVisibles: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: []
    },
    scoreConfiance: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  },
  { _id: false }
);

const resultatGlobalSchema = new mongoose.Schema(
  {
    pourcentageAcceptable: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    niveauQualite: {
      type: String,
      enum: [
        'EXCELLENT',
        'BON',
        'MOYEN',
        'A_CONSOMMER_RAPIDEMENT',
        'NON_CONFORME'
      ],
      required: true
    },
    decision: {
      type: String,
      enum: ['ACCEPTE', 'CONTROLE_HUMAIN_REQUIS', 'REFUSE'],
      required: true
    },
    scoreConfianceGlobal: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  },
  { _id: false }
);

const iaAnalyseSchema = new mongoose.Schema(
  {
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true
    },
    imagesAnalysees: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      required: true,
      validate: {
        validator: (images) => images.length > 0,
        message: 'Au moins une image doit être analysée'
      }
    },
    elementsDetectes: {
      type: [elementDetecteSchema],
      required: true,
      validate: {
        validator: (elements) => elements.length > 0,
        message: 'Au moins un élément doit être détecté'
      }
    },
    resultatGlobal: {
      type: resultatGlobalSchema,
      required: true
    },
    recommandation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },
    avertissement: {
      type: String,
      trim: true,
      default:
        'Estimation visuelle uniquement : une validation humaine et les données de conservation restent nécessaires.'
    },
    modeleUtilise: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    versionModele: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    dureeTraitementMs: {
      type: Number,
      min: 0,
      default: null
    }
  },
  { timestamps: true }
);

iaAnalyseSchema.index({ donation: 1, createdAt: -1 });
iaAnalyseSchema.index({ 'resultatGlobal.decision': 1, createdAt: -1 });

module.exports = mongoose.model('IaAnalyse', iaAnalyseSchema);
