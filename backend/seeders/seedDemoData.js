require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const CategorieDonation = require('../models/CategorieDonation');
const Donation = require('../models/Donation');
const Collecte = require('../models/Collecte');
const IaAnalyse = require('../models/IaAnalyse');
const Rapport = require('../models/Rapport');

const DEMO_EMAILS = [
  'admin@rescuefood.demo',
  'marche.centre@rescuefood.demo',
  'boulangerie.soleil@rescuefood.demo',
  'solidarite@rescuefood.demo',
  'entraide@rescuefood.demo',
  'transport@rescuefood.demo',
  'citoyen@rescuefood.demo'
];

function addDays(days, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function upsertDemoUsers() {
  const users = [
    {
      nom: 'Ben Salem',
      prenom: 'Amira',
      email: DEMO_EMAILS[0],
      motDePasse: 'Demo1234!',
      telephone: '+216 20 100 100',
      role: 'ADMIN',
      adresse: '1 avenue Habib-Bourguiba, Tunis',
      localisation: { latitude: 36.8065, longitude: 10.1815 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Marché du Centre',
      prenom: 'Équipe',
      email: DEMO_EMAILS[1],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 200 200',
      role: 'FOURNISSEUR',
      adresse: 'Marché central, Tunis',
      localisation: { latitude: 36.7982, longitude: 10.1706 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Boulangerie du Soleil',
      prenom: 'Équipe',
      email: DEMO_EMAILS[2],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 300 300',
      role: 'FOURNISSEUR',
      adresse: '12 rue de Marseille, Tunis',
      localisation: { latitude: 36.8037, longitude: 10.1811 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Solidarité Tunis',
      prenom: 'Association',
      email: DEMO_EMAILS[3],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 400 400',
      role: 'ONG',
      adresse: '25 rue de Palestine, Tunis',
      localisation: { latitude: 36.8189, longitude: 10.1817 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Entraide Carthage',
      prenom: 'Association',
      email: DEMO_EMAILS[4],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 500 500',
      role: 'ONG',
      adresse: '8 avenue de Carthage, Tunis',
      localisation: { latitude: 36.8528, longitude: 10.3233 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Logistique Solidaire',
      prenom: 'Sami',
      email: DEMO_EMAILS[5],
      motDePasse: 'Demo1234!',
      telephone: '+216 22 600 600',
      role: 'TRANSPORTEUR',
      adresse: 'Zone industrielle, Charguia',
      localisation: { latitude: 36.8492, longitude: 10.1956 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Trabelsi',
      prenom: 'Nour',
      email: DEMO_EMAILS[6],
      motDePasse: 'Demo1234!',
      telephone: '+216 55 700 700',
      role: 'CITOYEN',
      adresse: 'La Marsa, Tunis',
      localisation: { latitude: 36.8782, longitude: 10.3247 },
      statutCompte: 'VALIDE'
    }
  ];

  const savedUsers = await Promise.all(
    users.map((user) =>
      User.findOneAndUpdate(
        { email: user.email },
        { $set: user },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
          setDefaultsOnInsert: true
        }
      )
    )
  );

  return Object.fromEntries(
    savedUsers.map((user) => [user.email, user])
  );
}

async function removePreviousDemoData(users) {
  const demoUserIds = Object.values(users).map((user) => user._id);
  const oldDonations = await Donation.find({
    fournisseur: { $in: demoUserIds }
  }).select('_id');
  const oldDonationIds = oldDonations.map((donation) => donation._id);

  await Promise.all([
    Collecte.deleteMany({ donation: { $in: oldDonationIds } }),
    IaAnalyse.deleteMany({ donation: { $in: oldDonationIds } }),
    IaAnalyse.deleteMany({
      $or: [{ donation: null }, { donation: { $exists: false } }]
    }),
    Rapport.deleteMany({ generePar: users[DEMO_EMAILS[0]]._id })
  ]);

  await Donation.deleteMany({ _id: { $in: oldDonationIds } });
}

async function seedDemoData() {
  try {
    await connectDB();

    const categories = await CategorieDonation.find();
    const categoriesByType = Object.fromEntries(
      categories.map((categorie) => [categorie.typeProduit, categorie])
    );

    if (categories.length < 7) {
      throw new Error(
        'Les catégories sont absentes. Lancez d’abord npm run seed:categories.'
      );
    }

    const users = await upsertDemoUsers();
    await removePreviousDemoData(users);

    const admin = users[DEMO_EMAILS[0]];
    const marche = users[DEMO_EMAILS[1]];
    const boulangerie = users[DEMO_EMAILS[2]];
    const ongSolidarite = users[DEMO_EMAILS[3]];
    const ongEntraide = users[DEMO_EMAILS[4]];
    const transporteur = users[DEMO_EMAILS[5]];

    const donations = await Donation.create([
      {
        titre: 'Cagettes de tomates à redistribuer',
        description: '25 kg de tomates mûres issues des invendus du jour.',
        fournisseur: marche._id,
        beneficiaire: ongSolidarite._id,
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        compositionLot: 'Tomates rouges mûres en cinq cagettes.',
        quantiteEstimee: 25,
        unite: 'KG',
        poidsTotalKg: 25,
        images: [
          'https://images.example.com/tomates-face.jpg',
          'https://images.example.com/tomates-dessus.jpg'
        ],
        temperatureStockage: 18,
        conditionsStockage: 'Stockage à l’ombre dans une zone ventilée.',
        statut: 'EN_COLLECTE',
        urgence: 'ELEVEE',
        dateDisponibilite: addDays(0, 9),
        dateLimiteCollecte: addDays(1, 17),
        adresseCollecte: marche.adresse,
        localisationCollecte: marche.localisation
      },
      {
        titre: 'Pains et viennoiseries du jour',
        description: '40 pains et 24 croissants prêts à être récupérés.',
        fournisseur: boulangerie._id,
        beneficiaire: ongEntraide._id,
        categorieDonation: categoriesByType.PAIN_VIENNOISERIE._id,
        compositionLot: '40 pains traditionnels et 24 croissants.',
        quantiteEstimee: 64,
        unite: 'UNITE',
        poidsTotalKg: 12.5,
        images: [
          'https://images.example.com/pains-lot.jpg',
          'https://images.example.com/viennoiseries-lot.jpg'
        ],
        temperatureStockage: 22,
        conditionsStockage: 'Produits conservés au sec dans des bacs alimentaires.',
        statut: 'LIVRE',
        urgence: 'ELEVEE',
        dateDisponibilite: addDays(-1, 18),
        dateLimiteCollecte: addDays(0, 10),
        adresseCollecte: boulangerie.adresse,
        localisationCollecte: boulangerie.localisation
      },
      {
        titre: 'Pommes disponibles cette semaine',
        description: '18 kg de pommes déclassées mais consommables.',
        fournisseur: marche._id,
        beneficiaire: null,
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        compositionLot: 'Pommes rouges et vertes légèrement déclassées.',
        quantiteEstimee: 18,
        unite: 'KG',
        poidsTotalKg: 18,
        images: [
          'https://images.example.com/pommes-face.jpg',
          'https://images.example.com/pommes-detail.jpg'
        ],
        temperatureStockage: 12,
        conditionsStockage: 'Stockage en cagettes dans une chambre fraîche.',
        statut: 'VALIDE',
        urgence: 'MOYENNE',
        dateDisponibilite: addDays(1, 8),
        dateLimiteCollecte: addDays(4, 18),
        adresseCollecte: marche.adresse,
        localisationCollecte: marche.localisation
      }
    ]);

    const [donTomates, donPain, donPommes] = donations;

    await Collecte.create([
      {
        donation: donTomates._id,
        transporteur: transporteur._id,
        fournisseur: marche._id,
        beneficiaire: ongSolidarite._id,
        statut: 'EN_ROUTE',
        adresseDepart: marche.adresse,
        adresseArrivee: ongSolidarite.adresse,
        localisationDepart: marche.localisation,
        localisationArrivee: ongSolidarite.localisation,
        distanceKm: 4.8,
        dureeEstimeeMinutes: 22,
        dateCollectePrevue: addDays(0, 14),
        itineraireOptimise: {
          polyline: 'demo_polyline_tunis_centre',
          scoreOptimisation: 0.91
        }
      },
      {
        donation: donPain._id,
        transporteur: transporteur._id,
        fournisseur: boulangerie._id,
        beneficiaire: ongEntraide._id,
        statut: 'LIVREE',
        adresseDepart: boulangerie.adresse,
        adresseArrivee: ongEntraide.adresse,
        localisationDepart: boulangerie.localisation,
        localisationArrivee: ongEntraide.localisation,
        distanceKm: 14.2,
        dureeEstimeeMinutes: 35,
        dateCollectePrevue: addDays(-1, 19),
        dateCollecteReelle: addDays(-1, 19),
        dateLivraison: addDays(-1, 20),
        itineraireOptimise: {
          polyline: 'demo_polyline_tunis_carthage',
          scoreOptimisation: 0.87
        }
      }
    ]);

    await IaAnalyse.create([
      {
        donation: donTomates._id,
        imagesAnalysees: donTomates.images,
        elementsDetectes: [
          {
            categorie: 'TOMATE',
            quantiteEstimee: 25,
            fraicheur: 'BON',
            defautsVisibles: ['quelques meurtrissures superficielles'],
            scoreConfiance: 0.94
          }
        ],
        resultatGlobal: {
          pourcentageAcceptable: 92,
          niveauQualite: 'BON',
          decision: 'ACCEPTE',
          scoreConfianceGlobal: 0.91
        },
        recommandation: 'Redistribuer dans les 24 heures.',
        modeleUtilise: 'rescuefood-lot-vision',
        versionModele: '1.0.0',
        dureeTraitementMs: 840
      },
      {
        donation: donPain._id,
        imagesAnalysees: donPain.images,
        elementsDetectes: [
          {
            categorie: 'PAIN',
            quantiteEstimee: 40,
            fraicheur: 'A_CONSOMMER_RAPIDEMENT',
            defautsVisibles: [],
            scoreConfiance: 0.97
          },
          {
            categorie: 'CROISSANT',
            quantiteEstimee: 24,
            fraicheur: 'BON',
            defautsVisibles: ['dessèchement léger'],
            scoreConfiance: 0.9
          }
        ],
        resultatGlobal: {
          pourcentageAcceptable: 96,
          niveauQualite: 'A_CONSOMMER_RAPIDEMENT',
          decision: 'ACCEPTE',
          scoreConfianceGlobal: 0.93
        },
        recommandation: 'Collecte et livraison le jour même recommandées.'
        ,
        modeleUtilise: 'rescuefood-lot-vision',
        versionModele: '1.0.0',
        dureeTraitementMs: 1120
      },
      {
        donation: donPommes._id,
        imagesAnalysees: donPommes.images,
        elementsDetectes: [
          {
            categorie: 'POMME',
            quantiteEstimee: 18,
            fraicheur: 'MOYEN',
            defautsVisibles: ['taches', 'meurtrissures localisées'],
            scoreConfiance: 0.78
          }
        ],
        resultatGlobal: {
          pourcentageAcceptable: 74,
          niveauQualite: 'MOYEN',
          decision: 'CONTROLE_HUMAIN_REQUIS',
          scoreConfianceGlobal: 0.76
        },
        recommandation:
          'Contrôler manuellement les fruits présentant des taches.',
        modeleUtilise: 'rescuefood-lot-vision',
        versionModele: '1.0.0',
        dureeTraitementMs: 910
      }
    ]);

    await Rapport.create({
      periode: {
        debut: addDays(-30, 0),
        fin: addDays(0, 23)
      },
      totalDons: donations.length,
      totalKgRedistribues: 55.5,
      totalCo2Economise: 138.75,
      nombreBeneficiaires: 2,
      nombreFournisseursActifs: 2,
      nombreOngActives: 2,
      donations: donations.map((donation) => donation._id),
      generePar: admin._id,
      typeRapport: 'MENSUEL',
      pdfUrl: 'https://files.example.com/rapports/rescuefood-demo.pdf'
    });

    console.log('Données de démonstration enregistrées :');
    console.log(`- ${Object.keys(users).length} utilisateurs`);
    console.log(`- ${donations.length} donations`);
    console.log('- 2 collectes');
    console.log('- 3 analyses IA');
    console.log('- 1 rapport');
  } catch (error) {
    console.error(
      'Erreur pendant la création des données de démonstration :',
      error
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDemoData();
