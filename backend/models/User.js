const mongoose = require('mongoose');

const localisationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse email invalide']
    },
    motDePasse: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    telephone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30
    },
    role: {
      type: String,
      enum: ['ADMIN', 'FOURNISSEUR', 'ONG', 'TRANSPORTEUR', 'CITOYEN'],
      required: true,
      default: 'CITOYEN'
    },
    adresse: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    localisation: {
      type: localisationSchema,
      default: undefined
    },
    statutCompte: {
      type: String,
      enum: ['EN_ATTENTE', 'VALIDE', 'REFUSE', 'SUSPENDU'],
      default: 'EN_ATTENTE'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
