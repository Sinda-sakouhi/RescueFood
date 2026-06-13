const MOTS_CLES = {
  FRUITS_LEGUMES: [
    'tomate', 'carotte', 'pomme', 'orange', 'salade',
    'légume', 'fruit', 'banane', 'courgette', 'poivron',
    'raisin', 'poire', 'fraise', 'cerise', 'abricot',
    'concombre', 'aubergine', 'épinard', 'brocoli', 'chou'
  ],
  PAIN_VIENNOISERIE: [
    'pain', 'baguette', 'croissant', 'viennoiserie',
    'brioche', 'boulangerie', 'gâteau', 'tarte',
    'muffin', 'eclair', 'chausson', 'feuilleté', 'cake'
  ],
  PRODUITS_LAITIERS: [
    'lait', 'fromage', 'yaourt', 'beurre',
    'crème', 'dairy', 'lactose', 'camembert',
    'gruyère', 'mozzarella', 'ricotta', 'feta'
  ],
  PLATS_PREPARES: [
    'plat', 'repas', 'cuisine', 'couscous',
    'tajine', 'sandwich', 'pizza', 'burger',
    'soupe', 'salade composée', 'lasagne', 'quiche', 'gratin'
  ],
  CONSERVES: [
    'conserve', 'boite', 'bocal', 'appertisé',
    'sardine', 'thon', 'haricot', 'maïs',
    'tomate pelée', 'lentille', 'pois chiche', 'confiture'
  ],
  BOISSONS: [
    'jus', 'eau', 'boisson', 'soda',
    'café', 'thé', 'limonade', 'smoothie',
    'sirop', 'nectar', 'infusion', 'jus de fruit'
  ]
};

function suggererCategorie(titre, description = '') {
  const texte = (titre + ' ' + description).toLowerCase();
  const scores = {};

  for (const [categorie, mots] of Object.entries(MOTS_CLES)) {
    scores[categorie] = 0;
    for (const mot of mots) {
      if (texte.includes(mot)) {
        scores[categorie]++;
      }
    }
  }

  const meilleure = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .find(([, score]) => score > 0);

  return meilleure ? meilleure[0] : 'AUTRE';
}

module.exports = { suggererCategorie };
