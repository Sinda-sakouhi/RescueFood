const mongoose = require('mongoose');

const categorieDonationSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    typeProduit: {
      type: String,
      required: true,
      unique: true,
      enum: [
        'FRUITS_LEGUMES',
        'PAIN_VIENNOISERIE',
        'PRODUITS_LAITIERS',
        'PLATS_PREPARES',
        'CONSERVES',
        'BOISSONS',
        'AUTRE'
      ]
    },
    prioriteRedistribution: {
      type: String,
      enum: ['FAIBLE', 'MOYENNE', 'ELEVEE'],
      default: 'MOYENNE'
    },
    dureeConservationEstimee: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'CategorieDonation',
  categorieDonationSchema
);
