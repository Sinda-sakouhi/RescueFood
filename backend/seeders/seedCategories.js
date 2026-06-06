require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const CategorieDonation = require('../models/CategorieDonation');

const categories = [
  {
    nom: 'Fruits et légumes',
    description: 'Fruits, légumes et produits végétaux frais.',
    typeProduit: 'FRUITS_LEGUMES',
    prioriteRedistribution: 'ELEVEE',
    dureeConservationEstimee: 5
  },
  {
    nom: 'Pain et viennoiserie',
    description: 'Pains, pâtisseries et produits de boulangerie.',
    typeProduit: 'PAIN_VIENNOISERIE',
    prioriteRedistribution: 'ELEVEE',
    dureeConservationEstimee: 2
  },
  {
    nom: 'Produits laitiers',
    description: 'Lait, fromages, yaourts et produits réfrigérés associés.',
    typeProduit: 'PRODUITS_LAITIERS',
    prioriteRedistribution: 'ELEVEE',
    dureeConservationEstimee: 7
  },
  {
    nom: 'Plats préparés',
    description: 'Repas cuisinés et portions prêtes à consommer.',
    typeProduit: 'PLATS_PREPARES',
    prioriteRedistribution: 'ELEVEE',
    dureeConservationEstimee: 3
  },
  {
    nom: 'Conserves',
    description: 'Produits appertisés et aliments à longue conservation.',
    typeProduit: 'CONSERVES',
    prioriteRedistribution: 'FAIBLE',
    dureeConservationEstimee: 365
  },
  {
    nom: 'Boissons',
    description: 'Eaux, jus et autres boissons non alcoolisées.',
    typeProduit: 'BOISSONS',
    prioriteRedistribution: 'MOYENNE',
    dureeConservationEstimee: 90
  },
  {
    nom: 'Autres produits',
    description: 'Produits alimentaires ne correspondant pas aux autres catégories.',
    typeProduit: 'AUTRE',
    prioriteRedistribution: 'MOYENNE',
    dureeConservationEstimee: 7
  }
];

async function seedCategories() {
  try {
    await connectDB();

    await Promise.all(
      categories.map((categorie) =>
        CategorieDonation.findOneAndUpdate(
          { typeProduit: categorie.typeProduit },
          categorie,
          { upsert: true, returnDocument: 'after', runValidators: true }
        )
      )
    );

    console.log(`${categories.length} catégories de donation enregistrées`);
  } catch (error) {
    console.error('Erreur pendant le seeding :', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedCategories();
