const test = require('node:test');
const assert = require('node:assert/strict');
const {
  peutTransitionner,
  prochainsStatuts,
  calculerDistanceKm,
  estimerDureeMinutes
} = require('../utils/logistique');
const {
  optimiserOrdreCollectes,
  evaluerRisqueRetard,
  scorerTransporteur
} = require('../utils/logistiqueIA');

test('le workflow autorise uniquement les transitions attendues', () => {
  assert.equal(peutTransitionner('PLANIFIEE', 'EN_ROUTE'), true);
  assert.equal(peutTransitionner('PLANIFIEE', 'LIVREE'), false);
  assert.equal(peutTransitionner('LIVREE', 'ANNULEE'), false);
  assert.deepEqual(prochainsStatuts('COLLECTEE'), ['LIVREE', 'ANNULEE']);
});

test('la distance logistique est calculée en kilomètres', () => {
  const distance = calculerDistanceKm(
    { latitude: 36.7982, longitude: 10.1706 },
    { latitude: 36.8189, longitude: 10.1817 }
  );

  assert.ok(distance > 2);
  assert.ok(distance < 3);
  assert.ok(estimerDureeMinutes(distance) >= 10);
});

test('l’optimisation privilégie une collecte proche et urgente', () => {
  const maintenant = new Date('2026-06-13T10:00:00.000Z');
  const resultat = optimiserOrdreCollectes(
    [
      {
        _id: 'loin',
        reference: 'COL-LOIN',
        statut: 'PLANIFIEE',
        donation: { urgence: 'FAIBLE', titre: 'Lot éloigné' },
        localisationDepart: { latitude: 36.9, longitude: 10.3 },
        localisationArrivee: { latitude: 36.91, longitude: 10.31 },
        dateCollectePrevue: '2026-06-13T14:00:00.000Z',
        dateLivraisonPrevue: '2026-06-13T15:00:00.000Z'
      },
      {
        _id: 'proche',
        reference: 'COL-PROCHE',
        statut: 'PLANIFIEE',
        donation: { urgence: 'ELEVEE', titre: 'Lot urgent' },
        localisationDepart: { latitude: 36.801, longitude: 10.171 },
        localisationArrivee: { latitude: 36.81, longitude: 10.18 },
        dateCollectePrevue: '2026-06-13T11:00:00.000Z',
        dateLivraisonPrevue: '2026-06-13T12:00:00.000Z'
      }
    ],
    { latitude: 36.7982, longitude: 10.1706 },
    maintenant
  );

  assert.equal(resultat.ordre[0].collecte._id, 'proche');
  assert.equal(resultat.ordre.length, 2);
  assert.ok(resultat.distanceOptimiseeKm > 0);
});

test('le risque de retard devient critique pour une collecte dépassée', () => {
  const analyse = evaluerRisqueRetard(
    {
      statut: 'PLANIFIEE',
      transporteur: 'transporteur',
      dateCollectePrevue: '2026-06-13T08:00:00.000Z',
      dateLivraisonPrevue: '2026-06-13T09:00:00.000Z',
      dureeEstimeeMinutes: 45
    },
    {
      ponctualiteTransporteur: 0.6,
      collectesActivesTransporteur: 3,
      maintenant: new Date('2026-06-13T10:00:00.000Z')
    }
  );

  assert.equal(analyse.niveau, 'CRITIQUE');
  assert.ok(analyse.pourcentage >= 70);
  assert.ok(analyse.raisons.includes('Heure de collecte prévue dépassée'));
});

test('la recommandation favorise proximité et disponibilité', () => {
  const collecte = {
    localisationDepart: { latitude: 36.8, longitude: 10.17 }
  };
  const proche = scorerTransporteur(
    { localisation: { latitude: 36.801, longitude: 10.171 } },
    collecte,
    { collectesActives: 0, ponctualite: 0.95, livraisonsTerminees: 8 }
  );
  const eloigne = scorerTransporteur(
    { localisation: { latitude: 36.95, longitude: 10.35 } },
    collecte,
    { collectesActives: 3, ponctualite: 0.75, livraisonsTerminees: 2 }
  );

  assert.ok(proche.score > eloigne.score);
  assert.ok(proche.pourcentage >= 80);
});
