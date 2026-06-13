require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const CategorieDonation = require('../models/CategorieDonation');
const Annonce = require('../models/Annonce');
const Matching = require('../models/Matching');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
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
    users.map(async (user) =>
      User.findOneAndUpdate(
        { email: user.email },
        {
          $set: {
            ...user,
            motDePasse: await bcrypt.hash(user.motDePasse, 12),
            emailVerifie: true
          }
        },
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
  const oldAnnonces = await Annonce.find({
    auteur: { $in: demoUserIds }
  }).select('_id');
  const oldAnnonceIds = oldAnnonces.map((annonce) => annonce._id);
  const oldMatchings = await Matching.find({
    $or: [
      { offre: { $in: oldAnnonceIds } },
      { demande: { $in: oldAnnonceIds } }
    ]
  }).select('_id');
  const oldMatchingIds = oldMatchings.map((matching) => matching._id);
  const oldConversations = await Conversation.find({
    $or: [
      { annonce: { $in: oldAnnonceIds } },
      { matching: { $in: oldMatchingIds } }
    ]
  }).select('_id');
  const oldConversationIds = oldConversations.map(
    (conversation) => conversation._id
  );
  const oldDonations = await Donation.find({
    fournisseur: { $in: demoUserIds }
  }).select('_id');
  const oldDonationIds = oldDonations.map((donation) => donation._id);

  await Promise.all([
    Message.deleteMany({ conversation: { $in: oldConversationIds } }),
    Conversation.deleteMany({ _id: { $in: oldConversationIds } }),
    Collecte.deleteMany({ donation: { $in: oldDonationIds } }),
    IaAnalyse.deleteMany({ donation: { $in: oldDonationIds } }),
    IaAnalyse.deleteMany({
      $or: [{ donation: null }, { donation: { $exists: false } }]
    }),
    Rapport.deleteMany({ generePar: users[DEMO_EMAILS[0]]._id })
  ]);

  await Donation.deleteMany({ _id: { $in: oldDonationIds } });
  await Matching.deleteMany({ _id: { $in: oldMatchingIds } });
  await Annonce.deleteMany({ _id: { $in: oldAnnonceIds } });
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

    const annonces = await Annonce.create([
      {
        auteur: marche._id,
        type: 'OFFRE',
        titre: 'Surplus de tomates fraîches',
        description:
          'Cinq cagettes de tomates disponibles pour une redistribution rapide.',
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        quantiteEstimee: 25,
        unite: 'KG',
        urgence: 'ELEVEE',
        images: ['https://images.example.com/tomates-face.jpg'],
        adresse: marche.adresse,
        localisation: marche.localisation,
        dateExpiration: addDays(1, 17),
        statut: 'ACTIVE'
      },
      {
        auteur: ongSolidarite._id,
        type: 'DEMANDE',
        titre: 'Besoin urgent de fruits et légumes',
        description:
          'Recherche de produits frais pour préparer des paniers solidaires.',
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        quantiteEstimee: 20,
        unite: 'KG',
        urgence: 'ELEVEE',
        images: [],
        adresse: ongSolidarite.adresse,
        localisation: ongSolidarite.localisation,
        dateExpiration: addDays(2, 18),
        statut: 'ACTIVE'
      },
      {
        auteur: boulangerie._id,
        type: 'OFFRE',
        titre: 'Pains disponibles en fin de journée',
        description: 'Pains et viennoiseries disponibles après la fermeture.',
        categorieDonation: categoriesByType.PAIN_VIENNOISERIE._id,
        quantiteEstimee: 50,
        unite: 'UNITE',
        urgence: 'ELEVEE',
        images: ['https://images.example.com/pains-lot.jpg'],
        adresse: boulangerie.adresse,
        localisation: boulangerie.localisation,
        dateExpiration: addDays(1, 10),
        statut: 'ACTIVE'
      },
      {
        auteur: ongEntraide._id,
        type: 'DEMANDE',
        titre: 'Recherche de produits laitiers',
        description: 'Besoin de lait pour les petits-déjeuners associatifs.',
        categorieDonation: categoriesByType.PRODUITS_LAITIERS._id,
        quantiteEstimee: 30,
        unite: 'L',
        urgence: 'MOYENNE',
        images: [],
        adresse: ongEntraide.adresse,
        localisation: ongEntraide.localisation,
        dateExpiration: addDays(7, 18),
        statut: 'ACTIVE'
      }
    ]);

    const [offreTomates, demandeLegumes] = annonces;

    const matchingTomates = await Matching.create({
      offre: offreTomates._id,
      demande: demandeLegumes._id,
      score: 0.91,
      criteres: {
        categorie: 1,
        distance: 0.82,
        quantite: 0.9,
        urgence: 1
      },
      distanceKm: 4.8,
      statut: 'ACCEPTE',
      expireLe: addDays(1, 12)
    });

    const donations = await Donation.create([
      {
        titre: 'Cagettes de tomates à redistribuer',
        description: '25 kg de tomates mûres issues des invendus du jour.',
        fournisseur: marche._id,
        beneficiaire: ongSolidarite._id,
        matchingSource: matchingTomates._id,
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
        beneficiaire: ongSolidarite._id,
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

    matchingTomates.statut = 'CONVERTI_EN_DON';
    matchingTomates.donationCreee = donTomates._id;
    await matchingTomates.save();

    await Annonce.updateMany(
      { _id: { $in: [offreTomates._id, demandeLegumes._id] } },
      {
        $set: { statut: 'MATCHEE' },
        $push: {
          historiqueStatuts: {
            statut: 'MATCHEE',
            date: new Date()
          }
        }
      }
    );

    const conversation = await Conversation.create({
      participants: [marche._id, ongSolidarite._id],
      annonce: offreTomates._id,
      matching: matchingTomates._id,
      statut: 'ACTIVE',
      dernierMessageAt: new Date()
    });

    await Message.create([
      {
        conversation: conversation._id,
        expediteur: ongSolidarite._id,
        contenu:
          'Bonjour, notre association peut récupérer les tomates cet après-midi.',
        luPar: [ongSolidarite._id, marche._id],
        dateLecture: new Date()
      },
      {
        conversation: conversation._id,
        expediteur: marche._id,
        contenu:
          'Parfait, les cinq cagettes seront prêtes à partir de 14 heures.',
        luPar: [marche._id],
        dateLecture: null
      }
    ]);

    await Collecte.create([
      {
        reference: 'COL-DEMO-001',
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
        dateLivraisonPrevue: addDays(0, 15),
        vehicule: 'Fourgon solidaire 01',
        positionActuelle: { latitude: 36.8071, longitude: 10.1764 },
        dernierePositionAt: new Date(),
        historiquePositions: [
          {
            latitude: 36.8071,
            longitude: 10.1764,
            enregistreeLe: new Date()
          }
        ],
        historiqueStatuts: [
          { statut: 'PLANIFIEE', modifiePar: admin._id },
          { statut: 'EN_ROUTE', modifiePar: transporteur._id }
        ],
        itineraireOptimise: {
          polyline: 'demo_polyline_tunis_centre',
          scoreOptimisation: 0.91
        }
      },
      {
        reference: 'COL-DEMO-002',
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
        dateLivraisonPrevue: addDays(-1, 20),
        dateLivraison: addDays(-1, 20),
        vehicule: 'Fourgon solidaire 01',
        positionActuelle: ongEntraide.localisation,
        dernierePositionAt: addDays(-1, 20),
        historiqueStatuts: [
          { statut: 'PLANIFIEE', modifiePar: admin._id },
          { statut: 'EN_ROUTE', modifiePar: transporteur._id },
          { statut: 'COLLECTEE', modifiePar: transporteur._id },
          { statut: 'LIVREE', modifiePar: transporteur._id }
        ],
        itineraireOptimise: {
          polyline: 'demo_polyline_tunis_carthage',
          scoreOptimisation: 0.87
        }
      },
      {
        reference: 'COL-DEMO-003',
        donation: donPommes._id,
        transporteur: null,
        fournisseur: marche._id,
        beneficiaire: ongSolidarite._id,
        statut: 'A_ASSIGNER',
        priorite: 'NORMALE',
        adresseDepart: marche.adresse,
        adresseArrivee: ongSolidarite.adresse,
        localisationDepart: marche.localisation,
        localisationArrivee: ongSolidarite.localisation,
        distanceKm: 4.8,
        dureeEstimeeMinutes: 22,
        dateCollectePrevue: addDays(1, 10),
        dateLivraisonPrevue: addDays(1, 11),
        positionActuelle: marche.localisation,
        dernierePositionAt: new Date(),
        historiqueStatuts: [
          {
            statut: 'A_ASSIGNER',
            modifiePar: admin._id,
            note: 'Collecte en attente d’un transporteur'
          }
        ]
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
    console.log(`- ${annonces.length} annonces`);
    console.log('- 1 matching automatique');
    console.log('- 1 conversation et 2 messages');
    console.log(`- ${donations.length} donations`);
    console.log('- 3 collectes');
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
