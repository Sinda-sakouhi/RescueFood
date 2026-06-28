const test = require('node:test');
const assert = require('node:assert/strict');
const {
  peutTransitionner,
  prochainsStatuts,
  calculerDistanceKm,
  estimerDureeMinutes
} = require('../utils/logistique');
const {
  construireContexteTunisien,
  optimiserOrdreCollectes,
  optimiserItineraireRoutierML,
  evaluerRisqueRetard,
  predireDureeCollecteML,
  predireRetardML,
  scorerTransporteur
} = require('../utils/logistiqueIA');

// Vérifie que le backend bloque les raccourcis incohérents dans le workflow.
test('le workflow autorise uniquement les transitions attendues', () => {
  assert.equal(peutTransitionner('PLANIFIEE', 'EN_ROUTE'), true);
  assert.equal(peutTransitionner('PLANIFIEE', 'LIVREE'), false);
  assert.equal(peutTransitionner('LIVREE', 'ANNULEE'), false);
  assert.deepEqual(prochainsStatuts('COLLECTEE'), ['LIVREE', 'ANNULEE']);
});

// Contrôle le calcul géographique sur deux coordonnées connues à Tunis.
test('la distance logistique est calculée en kilomètres', () => {
  const distance = calculerDistanceKm(
    { latitude: 36.7982, longitude: 10.1706 },
    { latitude: 36.8189, longitude: 10.1817 }
  );

  assert.ok(distance > 2);
  assert.ok(distance < 3);
  assert.ok(estimerDureeMinutes(distance) >= 10);
});

// Vérifie que le score de tournée place une mission proche et urgente en tête.
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

// Reproduit une mission dépassée et chargée pour valider le niveau CRITIQUE.
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

// Compare deux profils afin de valider l'ordre du classement des transporteurs.
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

// Vérifie que le modèle ML tient compte du contexte et pas seulement de la distance.
test('le modèle ML augmente la durée prévue en heure de pointe', () => {
  const collecte = {
    statut: 'PLANIFIEE',
    donation: { urgence: 'MOYENNE' },
    distanceKm: 8,
    dureeEstimeeMinutes: 20,
    dateCollectePrevue: '2026-06-15T08:00:00.000Z'
  };
  const fluide = predireDureeCollecteML(
    {
      ...collecte,
      dateCollectePrevue: '2026-06-15T11:00:00.000Z'
    },
    {
      collectesActivesTransporteur: 0,
      ponctualiteTransporteur: 0.95
    }
  );
  const charge = predireDureeCollecteML(collecte, {
    collectesActivesTransporteur: 3,
    ponctualiteTransporteur: 0.65
  });

  assert.ok(charge.dureePrediteMinutes > fluide.dureePrediteMinutes);
  assert.equal(charge.caracteristiques.heurePointe, true);
});

// Vérifie que le contexte tunisien enrichit la prédiction avec zone et météo.
test('le contexte tunisien ajoute zone, météo et pénalité locale', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      current: {
        precipitation: 1.2,
        rain: 1.2,
        weather_code: 61,
        wind_speed_10m: 38
      }
    })
  });
  const collecte = {
    statut: 'PLANIFIEE',
    localisationDepart: { latitude: 36.8065, longitude: 10.1815 },
    localisationArrivee: { latitude: 36.839, longitude: 10.244 },
    dateCollectePrevue: '2026-06-19T12:00:00.000Z',
    donation: { urgence: 'ELEVEE' },
    dureeEstimeeMinutes: 20
  };

  const contexte = await construireContexteTunisien(collecte, {
    fetchImpl,
    maintenant: new Date('2026-06-19T10:00:00.000Z')
  });
  const prediction = predireDureeCollecteML(collecte, {
    contexteTunisien: contexte,
    collectesActivesTransporteur: 1,
    ponctualiteTransporteur: 0.9
  });

  assert.equal(contexte.zoneDepart.nom, 'Centre-ville Tunis');
  assert.equal(contexte.heurePointe.type, 'VENDREDI_MIDI');
  assert.equal(contexte.meteo.pluie, true);
  assert.equal(contexte.meteo.ventFort, true);
  assert.ok(prediction.dureePrediteMinutes > collecte.dureeEstimeeMinutes);
  assert.equal(prediction.caracteristiques.zoneDepart, 'Centre-ville Tunis');
});

// Reproduit une livraison impossible dans les temps avec le modèle ML.
test('le retard ML devient critique quand la durée prédite dépasse l’échéance', () => {
  const prediction = predireRetardML(
    {
      statut: 'PLANIFIEE',
      transporteur: 'transporteur',
      donation: { urgence: 'ELEVEE' },
      distanceKm: 15,
      dureeEstimeeMinutes: 45,
      dateCollectePrevue: '2026-06-15T08:00:00.000Z',
      dateLivraisonPrevue: '2026-06-15T08:20:00.000Z'
    },
    {
      collectesActivesTransporteur: 4,
      ponctualiteTransporteur: 0.6,
      maintenant: new Date('2026-06-15T08:00:00.000Z')
    }
  );

  assert.equal(prediction.niveau, 'CRITIQUE');
  assert.ok(prediction.dureePrediteMinutes > 20);
});

// Mocke OSRM pour vérifier que la nouvelle optimisation utilise un ordre routier.
test('l’optimisation ML utilise l’ordre renvoyé par OSRM', async () => {
  const collectes = [
    {
      _id: 'collecte-1',
      reference: 'COL-1',
      statut: 'PLANIFIEE',
      donation: { urgence: 'FAIBLE', titre: 'Mission 1' },
      localisationDepart: { latitude: 36.82, longitude: 10.19 },
      localisationArrivee: { latitude: 36.83, longitude: 10.2 },
      dateCollectePrevue: '2026-06-15T10:00:00.000Z'
    },
    {
      _id: 'collecte-2',
      reference: 'COL-2',
      statut: 'PLANIFIEE',
      donation: { urgence: 'ELEVEE', titre: 'Mission 2' },
      localisationDepart: { latitude: 36.8, longitude: 10.17 },
      localisationArrivee: { latitude: 36.81, longitude: 10.18 },
      dateCollectePrevue: '2026-06-15T09:00:00.000Z'
    }
  ];
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () =>
      url.includes('/trip/')
        ? {
            code: 'Ok',
            waypoints: [
              { waypoint_index: 0 },
              { waypoint_index: 2 },
              { waypoint_index: 1 }
            ]
          }
        : {
            code: 'Ok',
            routes: [
              {
                distance: 12300,
                duration: 1800,
                geometry: 'polyline-demo'
              }
            ]
          }
  });

  const resultat = await optimiserItineraireRoutierML(
    collectes,
    { latitude: 36.8065, longitude: 10.1815 },
    { fetchImpl }
  );

  assert.equal(resultat.sourceRouting, 'OSRM');
  assert.equal(resultat.ordreOptimise[0].collecte._id, 'collecte-2');
  assert.equal(resultat.polyline, 'polyline-demo');
  assert.ok(resultat.ordreOptimise[0].dureePrediteMinutes > 0);
});
