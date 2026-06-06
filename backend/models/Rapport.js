const mongoose = require('mongoose');

const periodeSchema = new mongoose.Schema(
  {
    debut: {
      type: Date,
      required: true
    },
    fin: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.debut || value >= this.debut;
        },
        message: 'La fin de période doit être postérieure au début'
      }
    }
  },
  { _id: false }
);

const rapportSchema = new mongoose.Schema(
  {
    periode: {
      type: periodeSchema,
      required: true
    },
    totalDons: {
      type: Number,
      min: 0,
      default: 0
    },
    totalKgRedistribues: {
      type: Number,
      min: 0,
      default: 0
    },
    totalCo2Economise: {
      type: Number,
      min: 0,
      default: 0
    },
    nombreBeneficiaires: {
      type: Number,
      min: 0,
      default: 0
    },
    nombreFournisseursActifs: {
      type: Number,
      min: 0,
      default: 0
    },
    nombreOngActives: {
      type: Number,
      min: 0,
      default: 0
    },
    donations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donation'
      }
    ],
    generePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    typeRapport: {
      type: String,
      enum: ['JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL', 'ANNUEL'],
      required: true
    },
    pdfUrl: {
      type: String,
      trim: true,
      default: null
    }
  },
  { timestamps: true }
);

rapportSchema.index({ typeRapport: 1, 'periode.debut': -1 });

module.exports = mongoose.model('Rapport', rapportSchema);
