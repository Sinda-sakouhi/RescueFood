require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

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
  'citoyen@rescuefood.demo',
  'grossiste.nord@rescuefood.demo',
  'hotel.lac@rescuefood.demo',
  'coeur.tunis@rescuefood.demo',
  'espoir.ariana@rescuefood.demo',
  'leila.transport@rescuefood.demo',
  'karim.express@rescuefood.demo',
  'noura.froid@rescuefood.demo',
  'mehdi.livraison@rescuefood.demo',
  'ines.mobile@rescuefood.demo'
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
    },
    {
      nom: 'Grossiste du Nord',
      prenom: 'Équipe',
      email: DEMO_EMAILS[7],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 710 710',
      role: 'FOURNISSEUR',
      adresse: 'Marché de gros, Ariana',
      localisation: { latitude: 36.8665, longitude: 10.1647 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Hôtel du Lac',
      prenom: 'Cuisine',
      email: DEMO_EMAILS[8],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 720 720',
      role: 'FOURNISSEUR',
      adresse: 'Les Berges du Lac 1, Tunis',
      localisation: { latitude: 36.8381, longitude: 10.2381 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Cœur de Tunis',
      prenom: 'Association',
      email: DEMO_EMAILS[9],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 730 730',
      role: 'ONG',
      adresse: 'Bab El Khadra, Tunis',
      localisation: { latitude: 36.8155, longitude: 10.1697 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Espoir Ariana',
      prenom: 'Association',
      email: DEMO_EMAILS[10],
      motDePasse: 'Demo1234!',
      telephone: '+216 71 740 740',
      role: 'ONG',
      adresse: 'Centre Ariana, Ariana',
      localisation: { latitude: 36.8625, longitude: 10.1956 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Transport Vert',
      prenom: 'Leila',
      email: DEMO_EMAILS[11],
      motDePasse: 'Demo1234!',
      telephone: '+216 22 711 711',
      role: 'TRANSPORTEUR',
      adresse: 'Montplaisir, Tunis',
      localisation: { latitude: 36.8182, longitude: 10.1907 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Express Tunis',
      prenom: 'Karim',
      email: DEMO_EMAILS[12],
      motDePasse: 'Demo1234!',
      telephone: '+216 22 722 722',
      role: 'TRANSPORTEUR',
      adresse: 'Bab Saadoun, Tunis',
      localisation: { latitude: 36.8095, longitude: 10.1534 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Chaîne du Froid',
      prenom: 'Noura',
      email: DEMO_EMAILS[13],
      motDePasse: 'Demo1234!',
      telephone: '+216 22 733 733',
      role: 'TRANSPORTEUR',
      adresse: 'Charguia 2, Ariana',
      localisation: { latitude: 36.8572, longitude: 10.2087 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Livraison Rapide',
      prenom: 'Mehdi',
      email: DEMO_EMAILS[14],
      motDePasse: 'Demo1234!',
      telephone: '+216 22 744 744',
      role: 'TRANSPORTEUR',
      adresse: 'Le Bardo, Tunis',
      localisation: { latitude: 36.8091, longitude: 10.1346 },
      statutCompte: 'VALIDE'
    },
    {
      nom: 'Mobile Solidaire',
      prenom: 'Inès',
      email: DEMO_EMAILS[15],
      motDePasse: 'Demo1234!',
      telephone: '+216 22 755 755',
      role: 'TRANSPORTEUR',
      adresse: 'La Soukra, Ariana',
      localisation: { latitude: 36.8771, longitude: 10.2513 },
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
    const grossiste = users[DEMO_EMAILS[7]];
    const hotel = users[DEMO_EMAILS[8]];
    const ongCoeur = users[DEMO_EMAILS[9]];
    const ongEspoir = users[DEMO_EMAILS[10]];
    const leila = users[DEMO_EMAILS[11]];
    const karim = users[DEMO_EMAILS[12]];
    const noura = users[DEMO_EMAILS[13]];
    const mehdi = users[DEMO_EMAILS[14]];
    const ines = users[DEMO_EMAILS[15]];

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
      },
      {
        auteur: grossiste._id,
        type: 'OFFRE',
        titre: 'Caisses de courgettes et poivrons',
        description: '32 kg de légumes frais issus du marché de gros.',
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        quantiteEstimee: 32,
        unite: 'KG',
        urgence: 'ELEVEE',
        images: ['https://images.example.com/courgettes-poivrons.jpg'],
        adresse: grossiste.adresse,
        localisation: grossiste.localisation,
        dateExpiration: addDays(1, 16),
        statut: 'ACTIVE'
      },
      {
        auteur: ongEspoir._id,
        type: 'DEMANDE',
        titre: 'Légumes pour 40 paniers familiaux',
        description: 'Recherche de légumes frais pour une distribution à Ariana.',
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        quantiteEstimee: 30,
        unite: 'KG',
        urgence: 'ELEVEE',
        images: [],
        adresse: ongEspoir.adresse,
        localisation: ongEspoir.localisation,
        dateExpiration: addDays(2, 17),
        statut: 'ACTIVE'
      },
      {
        auteur: hotel._id,
        type: 'OFFRE',
        titre: 'Plateaux de couscous et légumes',
        description: '45 portions préparées et conservées en liaison froide.',
        categorieDonation: categoriesByType.PLATS_PREPARES._id,
        quantiteEstimee: 45,
        unite: 'PORTION',
        urgence: 'ELEVEE',
        images: ['https://images.example.com/couscous.jpg'],
        adresse: hotel.adresse,
        localisation: hotel.localisation,
        dateExpiration: addDays(1, 13),
        statut: 'ACTIVE'
      },
      {
        auteur: ongCoeur._id,
        type: 'DEMANDE',
        titre: 'Repas chauds pour la maraude',
        description: 'Besoin de 40 portions pour la distribution du soir.',
        categorieDonation: categoriesByType.PLATS_PREPARES._id,
        quantiteEstimee: 40,
        unite: 'PORTION',
        urgence: 'ELEVEE',
        images: [],
        adresse: ongCoeur.adresse,
        localisation: ongCoeur.localisation,
        dateExpiration: addDays(1, 18),
        statut: 'ACTIVE'
      },
      {
        auteur: boulangerie._id,
        type: 'OFFRE',
        titre: 'Lot de baguettes et brioches',
        description: '80 pièces disponibles après la fermeture.',
        categorieDonation: categoriesByType.PAIN_VIENNOISERIE._id,
        quantiteEstimee: 80,
        unite: 'UNITE',
        urgence: 'ELEVEE',
        images: ['https://images.example.com/baguettes-brioches.jpg'],
        adresse: boulangerie.adresse,
        localisation: boulangerie.localisation,
        dateExpiration: addDays(1, 11),
        statut: 'ACTIVE'
      },
      {
        auteur: ongCoeur._id,
        type: 'DEMANDE',
        titre: 'Pain pour le petit-déjeuner solidaire',
        description: 'Besoin de 70 pains et viennoiseries.',
        categorieDonation: categoriesByType.PAIN_VIENNOISERIE._id,
        quantiteEstimee: 70,
        unite: 'UNITE',
        urgence: 'MOYENNE',
        images: [],
        adresse: ongCoeur.adresse,
        localisation: ongCoeur.localisation,
        dateExpiration: addDays(2, 9),
        statut: 'ACTIVE'
      },
      {
        auteur: hotel._id,
        type: 'OFFRE',
        titre: 'Yaourts et lait longue conservation',
        description: '24 litres de lait et 36 yaourts encore consommables.',
        categorieDonation: categoriesByType.PRODUITS_LAITIERS._id,
        quantiteEstimee: 60,
        unite: 'UNITE',
        urgence: 'MOYENNE',
        images: ['https://images.example.com/lait-yaourts.jpg'],
        adresse: hotel.adresse,
        localisation: hotel.localisation,
        dateExpiration: addDays(4, 12),
        statut: 'ACTIVE'
      },
      {
        auteur: ongEspoir._id,
        type: 'DEMANDE',
        titre: 'Produits laitiers pour enfants',
        description: 'Recherche de lait et yaourts pour 35 enfants.',
        categorieDonation: categoriesByType.PRODUITS_LAITIERS._id,
        quantiteEstimee: 50,
        unite: 'UNITE',
        urgence: 'MOYENNE',
        images: [],
        adresse: ongEspoir.adresse,
        localisation: ongEspoir.localisation,
        dateExpiration: addDays(5, 17),
        statut: 'ACTIVE'
      },
      {
        auteur: grossiste._id,
        type: 'OFFRE',
        titre: 'Cartons de conserves variées',
        description: '120 boîtes de tomates, pois chiches et thon.',
        categorieDonation: categoriesByType.CONSERVES._id,
        quantiteEstimee: 120,
        unite: 'UNITE',
        urgence: 'FAIBLE',
        images: ['https://images.example.com/conserves.jpg'],
        adresse: grossiste.adresse,
        localisation: grossiste.localisation,
        dateExpiration: addDays(12, 16),
        statut: 'ACTIVE'
      },
      {
        auteur: ongEntraide._id,
        type: 'DEMANDE',
        titre: 'Conserves pour la réserve alimentaire',
        description: 'Besoin de 100 boîtes pour compléter le stock mensuel.',
        categorieDonation: categoriesByType.CONSERVES._id,
        quantiteEstimee: 100,
        unite: 'UNITE',
        urgence: 'FAIBLE',
        images: [],
        adresse: ongEntraide.adresse,
        localisation: ongEntraide.localisation,
        dateExpiration: addDays(15, 18),
        statut: 'ACTIVE'
      },
      {
        auteur: marche._id,
        type: 'OFFRE',
        titre: 'Jus et bouteilles d’eau',
        description: '50 bouteilles disponibles pour une association.',
        categorieDonation: categoriesByType.BOISSONS._id,
        quantiteEstimee: 50,
        unite: 'UNITE',
        urgence: 'FAIBLE',
        images: ['https://images.example.com/boissons.jpg'],
        adresse: marche.adresse,
        localisation: marche.localisation,
        dateExpiration: addDays(10, 17),
        statut: 'ACTIVE'
      },
      {
        auteur: ongSolidarite._id,
        type: 'DEMANDE',
        titre: 'Boissons pour une journée associative',
        description: 'Recherche de 45 bouteilles d’eau et de jus.',
        categorieDonation: categoriesByType.BOISSONS._id,
        quantiteEstimee: 45,
        unite: 'UNITE',
        urgence: 'MOYENNE',
        images: [],
        adresse: ongSolidarite.adresse,
        localisation: ongSolidarite.localisation,
        dateExpiration: addDays(7, 18),
        statut: 'ACTIVE'
      }
    ]);

    const [
      offreTomates,
      demandeLegumes,
      offrePainInitiale,
      demandeLaitInitiale,
      offreLegumesAriana,
      demandeLegumesAriana,
      offreRepas,
      demandeRepas,
      offrePain,
      demandePain,
      offreLait,
      demandeLait,
      offreConserves,
      demandeConserves,
      offreBoissons,
      demandeBoissons
    ] = annonces;

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

    const matchingsSupplementaires = await Matching.create([
      {
        offre: offreLegumesAriana._id,
        demande: demandeLegumesAriana._id,
        score: 0.96,
        criteres: { categorie: 1, distance: 0.94, quantite: 0.94, urgence: 1 },
        distanceKm: 1.9,
        statut: 'ACCEPTE',
        expireLe: addDays(1, 15)
      },
      {
        offre: offreRepas._id,
        demande: demandeRepas._id,
        score: 0.88,
        criteres: { categorie: 1, distance: 0.76, quantite: 0.89, urgence: 1 },
        distanceKm: 8.2,
        statut: 'ACCEPTE',
        expireLe: addDays(1, 12)
      },
      {
        offre: offrePain._id,
        demande: demandePain._id,
        score: 0.93,
        criteres: { categorie: 1, distance: 0.92, quantite: 0.88, urgence: 0.5 },
        distanceKm: 2.6,
        statut: 'ACCEPTE',
        expireLe: addDays(1, 10)
      },
      {
        offre: offreLait._id,
        demande: demandeLait._id,
        score: 0.82,
        criteres: { categorie: 1, distance: 0.73, quantite: 0.83, urgence: 1 },
        distanceKm: 9.1,
        statut: 'PROPOSE',
        expireLe: addDays(2, 12)
      },
      {
        offre: offreConserves._id,
        demande: demandeConserves._id,
        score: 0.79,
        criteres: { categorie: 1, distance: 0.58, quantite: 0.83, urgence: 1 },
        distanceKm: 14.4,
        statut: 'ACCEPTE',
        expireLe: addDays(4, 18)
      },
      {
        offre: offreBoissons._id,
        demande: demandeBoissons._id,
        score: 0.91,
        criteres: { categorie: 1, distance: 0.93, quantite: 0.9, urgence: 0.5 },
        distanceKm: 2.5,
        statut: 'PROPOSE',
        expireLe: addDays(3, 18)
      }
    ]);

    const [
      matchingLegumesAriana,
      matchingRepas,
      matchingPain,
      matchingLait,
      matchingConserves,
      matchingBoissons
    ] = matchingsSupplementaires;

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
      },
      {
        titre: 'Courgettes et poivrons pour Ariana',
        description: '32 kg de légumes frais à redistribuer rapidement.',
        fournisseur: grossiste._id,
        beneficiaire: ongEspoir._id,
        matchingSource: matchingLegumesAriana._id,
        categorieDonation: categoriesByType.FRUITS_LEGUMES._id,
        compositionLot: 'Courgettes vertes et poivrons rouges en cagettes.',
        quantiteEstimee: 32,
        unite: 'KG',
        poidsTotalKg: 32,
        images: ['https://images.example.com/courgettes-poivrons.jpg'],
        temperatureStockage: 14,
        conditionsStockage: 'Conserver en zone fraîche et ventilée.',
        statut: 'VALIDE',
        urgence: 'ELEVEE',
        dateDisponibilite: addDays(0, 11),
        dateLimiteCollecte: addDays(1, 16),
        adresseCollecte: grossiste.adresse,
        localisationCollecte: grossiste.localisation
      },
      {
        titre: '45 portions de couscous',
        description: 'Plateaux préparés et maintenus en liaison froide.',
        fournisseur: hotel._id,
        beneficiaire: ongCoeur._id,
        matchingSource: matchingRepas._id,
        categorieDonation: categoriesByType.PLATS_PREPARES._id,
        compositionLot: 'Couscous, légumes et portions de poulet.',
        quantiteEstimee: 45,
        unite: 'PORTION',
        poidsTotalKg: 28,
        images: ['https://images.example.com/couscous.jpg'],
        temperatureStockage: 4,
        conditionsStockage: 'Transport frigorifique obligatoire.',
        statut: 'EN_COLLECTE',
        urgence: 'ELEVEE',
        dateDisponibilite: addDays(0, 12),
        dateLimiteCollecte: addDays(0, 15),
        adresseCollecte: hotel.adresse,
        localisationCollecte: hotel.localisation
      },
      {
        titre: 'Baguettes et brioches solidaires',
        description: '80 pièces de boulangerie pour le petit-déjeuner.',
        fournisseur: boulangerie._id,
        beneficiaire: ongCoeur._id,
        matchingSource: matchingPain._id,
        categorieDonation: categoriesByType.PAIN_VIENNOISERIE._id,
        compositionLot: '60 baguettes et 20 brioches.',
        quantiteEstimee: 80,
        unite: 'UNITE',
        poidsTotalKg: 18,
        images: ['https://images.example.com/baguettes-brioches.jpg'],
        temperatureStockage: 21,
        conditionsStockage: 'Bacs alimentaires secs.',
        statut: 'VALIDE',
        urgence: 'ELEVEE',
        dateDisponibilite: addDays(1, 7),
        dateLimiteCollecte: addDays(1, 10),
        adresseCollecte: boulangerie.adresse,
        localisationCollecte: boulangerie.localisation
      },
      {
        titre: 'Stock de conserves variées',
        description: '120 boîtes pour renforcer la réserve alimentaire.',
        fournisseur: grossiste._id,
        beneficiaire: ongEntraide._id,
        matchingSource: matchingConserves._id,
        categorieDonation: categoriesByType.CONSERVES._id,
        compositionLot: 'Tomates, pois chiches, haricots et thon.',
        quantiteEstimee: 120,
        unite: 'UNITE',
        poidsTotalKg: 48,
        images: ['https://images.example.com/conserves.jpg'],
        temperatureStockage: 20,
        conditionsStockage: 'Stockage au sec.',
        statut: 'VALIDE',
        urgence: 'FAIBLE',
        dateDisponibilite: addDays(2, 9),
        dateLimiteCollecte: addDays(8, 17),
        adresseCollecte: grossiste.adresse,
        localisationCollecte: grossiste.localisation
      },
      {
        titre: 'Produits laitiers du buffet',
        description: 'Lait et yaourts disponibles pour une redistribution.',
        fournisseur: hotel._id,
        beneficiaire: ongEspoir._id,
        categorieDonation: categoriesByType.PRODUITS_LAITIERS._id,
        compositionLot: '24 litres de lait et 36 yaourts.',
        quantiteEstimee: 60,
        unite: 'UNITE',
        poidsTotalKg: 38,
        images: ['https://images.example.com/lait-yaourts.jpg'],
        temperatureStockage: 4,
        conditionsStockage: 'Chaîne du froid obligatoire.',
        statut: 'VALIDE',
        urgence: 'MOYENNE',
        dateDisponibilite: addDays(1, 8),
        dateLimiteCollecte: addDays(3, 12),
        adresseCollecte: hotel.adresse,
        localisationCollecte: hotel.localisation
      }
    ]);

    const [
      donTomates,
      donPain,
      donPommes,
      donLegumesAriana,
      donRepas,
      donBaguettes,
      donConserves,
      donLait
    ] = donations;

    matchingTomates.statut = 'CONVERTI_EN_DON';
    matchingTomates.donationCreee = donTomates._id;
    matchingLegumesAriana.statut = 'CONVERTI_EN_DON';
    matchingLegumesAriana.donationCreee = donLegumesAriana._id;
    matchingRepas.statut = 'CONVERTI_EN_DON';
    matchingRepas.donationCreee = donRepas._id;
    matchingPain.statut = 'CONVERTI_EN_DON';
    matchingPain.donationCreee = donBaguettes._id;
    matchingConserves.statut = 'CONVERTI_EN_DON';
    matchingConserves.donationCreee = donConserves._id;
    await Promise.all([
      matchingTomates.save(),
      matchingLegumesAriana.save(),
      matchingRepas.save(),
      matchingPain.save(),
      matchingConserves.save()
    ]);

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

    await Annonce.updateMany(
      {
        _id: {
          $in: [
            offreLegumesAriana._id,
            demandeLegumesAriana._id,
            offreRepas._id,
            demandeRepas._id,
            offrePain._id,
            demandePain._id,
            offreConserves._id,
            demandeConserves._id
          ]
        }
      },
      {
        $set: { statut: 'MATCHEE' },
        $push: { historiqueStatuts: { statut: 'MATCHEE', date: new Date() } }
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

    const conversationsSupplementaires = await Conversation.create([
      {
        participants: [grossiste._id, ongEspoir._id],
        annonce: offreLegumesAriana._id,
        matching: matchingLegumesAriana._id,
        statut: 'ACTIVE',
        dernierMessageAt: new Date()
      },
      {
        participants: [hotel._id, ongCoeur._id],
        annonce: offreRepas._id,
        matching: matchingRepas._id,
        statut: 'ACTIVE',
        dernierMessageAt: new Date()
      },
      {
        participants: [boulangerie._id, ongCoeur._id],
        annonce: offrePain._id,
        matching: matchingPain._id,
        statut: 'ACTIVE',
        dernierMessageAt: new Date()
      },
      {
        participants: [grossiste._id, ongEntraide._id],
        annonce: offreConserves._id,
        matching: matchingConserves._id,
        statut: 'ACTIVE',
        dernierMessageAt: new Date()
      }
    ]);

    const [convLegumes, convRepas, convPain, convConserves] =
      conversationsSupplementaires;
    await Message.create([
      {
        conversation: convLegumes._id,
        expediteur: ongEspoir._id,
        contenu: 'Nous pouvons recevoir les légumes demain matin.',
        luPar: [ongEspoir._id, grossiste._id],
        dateLecture: new Date()
      },
      {
        conversation: convLegumes._id,
        expediteur: grossiste._id,
        contenu: 'Les cagettes seront prêtes au quai numéro 3.',
        luPar: [grossiste._id],
        dateLecture: null
      },
      {
        conversation: convRepas._id,
        expediteur: hotel._id,
        contenu: 'Les 45 portions sont conditionnées et étiquetées.',
        luPar: [hotel._id, ongCoeur._id],
        dateLecture: new Date()
      },
      {
        conversation: convRepas._id,
        expediteur: ongCoeur._id,
        contenu: 'Merci, une livraison avant 18 heures conviendrait.',
        luPar: [ongCoeur._id],
        dateLecture: null
      },
      {
        conversation: convPain._id,
        expediteur: ongCoeur._id,
        contenu: 'Nous confirmons le besoin de 70 pièces.',
        luPar: [ongCoeur._id, boulangerie._id],
        dateLecture: new Date()
      },
      {
        conversation: convPain._id,
        expediteur: boulangerie._id,
        contenu: 'Nous ajouterons dix brioches supplémentaires.',
        luPar: [boulangerie._id],
        dateLecture: null
      },
      {
        conversation: convConserves._id,
        expediteur: ongEntraide._id,
        contenu: 'La réserve peut recevoir les cartons jeudi.',
        luPar: [ongEntraide._id, grossiste._id],
        dateLecture: new Date()
      },
      {
        conversation: convConserves._id,
        expediteur: grossiste._id,
        contenu: 'Le lot sera filmé sur deux palettes.',
        luPar: [grossiste._id],
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
      },
      {
        reference: 'COL-DEMO-004',
        donation: donLegumesAriana._id,
        transporteur: leila._id,
        fournisseur: grossiste._id,
        beneficiaire: ongEspoir._id,
        statut: 'PLANIFIEE',
        priorite: 'URGENTE',
        adresseDepart: grossiste.adresse,
        adresseArrivee: ongEspoir.adresse,
        localisationDepart: grossiste.localisation,
        localisationArrivee: ongEspoir.localisation,
        distanceKm: 4.1,
        dureeEstimeeMinutes: 18,
        dateCollectePrevue: addDays(1, 9),
        dateLivraisonPrevue: addDays(1, 10),
        vehicule: 'Camionnette verte 04',
        positionActuelle: leila.localisation,
        dernierePositionAt: new Date(),
        historiqueStatuts: [
          {
            statut: 'PLANIFIEE',
            modifiePar: admin._id,
            note: 'Leila recommandée par le score IA'
          }
        ]
      },
      {
        reference: 'COL-DEMO-005',
        donation: donRepas._id,
        transporteur: noura._id,
        fournisseur: hotel._id,
        beneficiaire: ongCoeur._id,
        statut: 'EN_ROUTE',
        priorite: 'URGENTE',
        adresseDepart: hotel.adresse,
        adresseArrivee: ongCoeur.adresse,
        localisationDepart: hotel.localisation,
        localisationArrivee: ongCoeur.localisation,
        distanceKm: 8.2,
        dureeEstimeeMinutes: 28,
        dateCollectePrevue: addDays(0, 12),
        dateCollecteReelle: addDays(0, 12),
        dateLivraisonPrevue: addDays(0, 13),
        vehicule: 'Fourgon frigorifique 07',
        positionActuelle: { latitude: 36.829, longitude: 10.211 },
        dernierePositionAt: new Date(Date.now() - 45 * 60000),
        historiquePositions: [
          {
            latitude: 36.829,
            longitude: 10.211,
            enregistreeLe: new Date(Date.now() - 45 * 60000)
          }
        ],
        historiqueStatuts: [
          { statut: 'PLANIFIEE', modifiePar: admin._id },
          { statut: 'EN_ROUTE', modifiePar: noura._id }
        ]
      },
      {
        reference: 'COL-DEMO-006',
        donation: donBaguettes._id,
        transporteur: karim._id,
        fournisseur: boulangerie._id,
        beneficiaire: ongCoeur._id,
        statut: 'PLANIFIEE',
        priorite: 'URGENTE',
        adresseDepart: boulangerie.adresse,
        adresseArrivee: ongCoeur.adresse,
        localisationDepart: boulangerie.localisation,
        localisationArrivee: ongCoeur.localisation,
        distanceKm: 2.6,
        dureeEstimeeMinutes: 12,
        dateCollectePrevue: addDays(1, 7),
        dateLivraisonPrevue: addDays(1, 8),
        vehicule: 'Utilitaire express 02',
        positionActuelle: karim.localisation,
        dernierePositionAt: new Date(),
        historiqueStatuts: [
          { statut: 'PLANIFIEE', modifiePar: admin._id }
        ]
      },
      {
        reference: 'COL-DEMO-007',
        donation: donConserves._id,
        transporteur: null,
        fournisseur: grossiste._id,
        beneficiaire: ongEntraide._id,
        statut: 'A_ASSIGNER',
        priorite: 'NORMALE',
        adresseDepart: grossiste.adresse,
        adresseArrivee: ongEntraide.adresse,
        localisationDepart: grossiste.localisation,
        localisationArrivee: ongEntraide.localisation,
        distanceKm: 14.4,
        dureeEstimeeMinutes: 36,
        dateCollectePrevue: addDays(3, 10),
        dateLivraisonPrevue: addDays(3, 12),
        positionActuelle: grossiste.localisation,
        dernierePositionAt: new Date(),
        historiqueStatuts: [
          {
            statut: 'A_ASSIGNER',
            modifiePar: admin._id,
            note: 'Comparer les recommandations des six transporteurs'
          }
        ]
      },
      {
        reference: 'COL-DEMO-008',
        donation: donLait._id,
        transporteur: noura._id,
        fournisseur: hotel._id,
        beneficiaire: ongEspoir._id,
        statut: 'PLANIFIEE',
        priorite: 'NORMALE',
        adresseDepart: hotel.adresse,
        adresseArrivee: ongEspoir.adresse,
        localisationDepart: hotel.localisation,
        localisationArrivee: ongEspoir.localisation,
        distanceKm: 7.9,
        dureeEstimeeMinutes: 25,
        dateCollectePrevue: addDays(1, 8),
        dateLivraisonPrevue: addDays(1, 9),
        vehicule: 'Fourgon frigorifique 07',
        positionActuelle: noura.localisation,
        dernierePositionAt: new Date(),
        historiqueStatuts: [
          { statut: 'PLANIFIEE', modifiePar: admin._id }
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
      totalKgRedistribues: 219.5,
      totalCo2Economise: 548.75,
      nombreBeneficiaires: 4,
      nombreFournisseursActifs: 4,
      nombreOngActives: 4,
      donations: donations.map((donation) => donation._id),
      generePar: admin._id,
      typeRapport: 'MENSUEL',
      pdfUrl: 'https://files.example.com/rapports/rescuefood-demo.pdf'
    });

    console.log('Données de démonstration enregistrées :');
    console.log(`- ${Object.keys(users).length} utilisateurs`);
    console.log(`- ${annonces.length} annonces`);
    console.log(`- ${1 + matchingsSupplementaires.length} matchings`);
    console.log(`- ${1 + conversationsSupplementaires.length} conversations`);
    console.log('- 10 messages');
    console.log(`- ${donations.length} donations`);
    console.log('- 8 collectes');
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
