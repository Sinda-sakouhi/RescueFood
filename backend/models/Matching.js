const mongoose = require('mongoose');

const criteresSchema = new mongoose.Schema(
  {
    categorie: { type: Number, required: true, min: 0, max: 1 },
    distance: { type: Number, required: true, min: 0, max: 1 },
    quantite: { type: Number, required: true, min: 0, max: 1 },
    urgence: { type: Number, required: true, min: 0, max: 1 }
  },
  { _id: false }
);

const matchingSchema = new mongoose.Schema(
  {
    donation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      required: true
    },
    demande: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Annonce',
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    criteres: {
      type: criteresSchema,
      required: true
    },
    distanceKm: {
      type: Number,
      min: 0,
      default: null
    },
    statut: {
      type: String,
      enum: ['PROPOSE', 'ACCEPTE', 'REFUSE', 'EXPIRE', 'CONVERTI_EN_DON'],
      default: 'PROPOSE'
    },
    donationCreee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation',
      default: null
    },
    expireLe: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

matchingSchema.index({ donation: 1, demande: 1 }, { unique: true });
matchingSchema.index({ statut: 1, score: -1 });

module.exports = mongoose.model('Matching', matchingSchema);
