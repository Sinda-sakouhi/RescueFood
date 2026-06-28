const { calculerDistanceKm, estimerDureeMinutes } = require('./logistique');

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS || 4500);

const COEFFICIENTS_DUREE_ML = Object.freeze({
  intercept: 3,
  dureeRoutiere: 1.08,
  heurePointe: 0.18,
  weekend: -0.08,
  urgenceElevee: -0.05,
  urgenceMoyenne: 0,
  missionsActives: 0.09,
  ponctualiteFaible: 0.22,
  distanceLongue: 0.06
});

/**
 * Maintient une valeur dans un intervalle, généralement entre 0 et 1.
 */
function borner(valeur, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, valeur));
}

/**
 * Arrondit les scores afin de produire des réponses API faciles à lire.
 */
function arrondir(valeur, decimales = 2) {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

/**
 * Valide qu'un point possède des coordonnées GPS exploitables par OSRM.
 */
function pointValide(point) {
  return (
    point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

/**
 * Convertit une position latitude/longitude au format OSRM longitude,latitude.
 */
function coordonneeOsrm(point) {
  return `${point.longitude},${point.latitude}`;
}

/**
 * Appelle OSRM avec un timeout court pour garder l'API utilisable en démo même
 * si le service public de routing est lent ou indisponible.
 */
async function appelerOsrm(path, { fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl) {
    throw new Error('Fetch indisponible pour appeler OSRM');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const url = `${OSRM_BASE_URL.replace(/\/$/, '')}${path}`;
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OSRM a répondu ${response.status}`);
    }

    const body = await response.json();
    if (body.code && body.code !== 'Ok') {
      throw new Error(`OSRM code ${body.code}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Demande à OSRM la route routière réelle dans un ordre déjà choisi.
 */
async function calculerRouteOsrm(points, options = {}) {
  if (points.length < 2 || points.some((point) => !pointValide(point))) {
    throw new Error('Points GPS insuffisants pour OSRM');
  }

  const coordonnees = points.map(coordonneeOsrm).join(';');
  const body = await appelerOsrm(
    `/route/v1/driving/${coordonnees}?overview=full&geometries=polyline`,
    options
  );
  const route = body.routes?.[0];
  if (!route) {
    throw new Error('Aucune route OSRM trouvée');
  }

  return {
    distanceKm: arrondir(route.distance / 1000, 1),
    dureeMinutes: Math.max(1, Math.round(route.duration / 60)),
    polyline: route.geometry || null
  };
}

/**
 * Utilise OSRM Trip pour optimiser l'ordre des points de collecte sur de vraies
 * routes routières. Les livraisons restent ensuite attachées à leur collecte.
 */
async function optimiserOrdrePickupOsrm(
  collectes,
  positionInitiale,
  options = {}
) {
  const pointsPickup = collectes.map(pointDepartCollecte);
  if (
    !pointValide(positionInitiale) ||
    pointsPickup.some((point) => !pointValide(point))
  ) {
    throw new Error('Coordonnées insuffisantes pour optimiser avec OSRM');
  }

  if (collectes.length === 1) {
    return collectes;
  }

  const coordonnees = [positionInitiale, ...pointsPickup]
    .map(coordonneeOsrm)
    .join(';');
  const body = await appelerOsrm(
    `/trip/v1/driving/${coordonnees}?source=first&destination=any&roundtrip=false&overview=false`,
    options
  );
  const waypoints = body.waypoints || [];
  const ordreParIndex = new Map(
    waypoints.map(({ waypoint_index: waypointIndex }, inputIndex) => [
      inputIndex,
      waypointIndex
    ])
  );

  return collectes
    .map((collecte, index) => ({
      collecte,
      ordreOsrm: ordreParIndex.get(index + 1) ?? index + 1
    }))
    .sort((a, b) => a.ordreOsrm - b.ordreOsrm)
    .map(({ collecte }) => collecte);
}

/**
 * Calcule le nombre d'heures restantes avant une date cible.
 */
function heuresAvant(date, maintenant = new Date()) {
  if (!date) return 24;
  return (new Date(date) - maintenant) / 3600000;
}

/**
 * Convertit le niveau d'urgence métier en score numérique normalisé.
 */
function scoreUrgence(urgence) {
  return { ELEVEE: 1, MOYENNE: 0.65, FAIBLE: 0.35 }[urgence] || 0.5;
}

/**
 * Donne davantage de poids aux missions dont l'échéance est proche.
 */
function scoreEcheance(date, maintenant) {
  const heures = heuresAvant(date, maintenant);
  if (heures <= 2) return 1;
  if (heures <= 6) return 0.85;
  if (heures <= 12) return 0.7;
  if (heures <= 24) return 0.5;
  return 0.3;
}

/**
 * Détermine le prochain point utile d'une collecte. Une mission déjà en cours
 * repart de sa position GPS actuelle plutôt que de son adresse initiale.
 */
function pointDepartCollecte(collecte) {
  if (
    ['EN_ROUTE', 'COLLECTEE'].includes(collecte.statut) &&
    collecte.positionActuelle
  ) {
    return collecte.positionActuelle;
  }
  return collecte.localisationDepart;
}

/**
 * Additionne les distances d'approche et de livraison d'une tournée dans
 * l'ordre fourni.
 */
function distanceSequence(collectes, positionInitiale) {
  let position = positionInitiale;
  let total = 0;

  for (const collecte of collectes) {
    const depart = pointDepartCollecte(collecte);
    if (position && depart) total += calculerDistanceKm(position, depart);
    if (depart && collecte.localisationArrivee) {
      total += calculerDistanceKm(depart, collecte.localisationArrivee);
    }
    position = collecte.localisationArrivee || depart || position;
  }

  return arrondir(total, 1);
}

/**
 * Construit la succession réelle des arrêts : position actuelle, départ de la
 * collecte, livraison ONG, puis collecte suivante.
 */
function construirePointsTournee(collectes, positionInitiale) {
  const points = [];
  if (pointValide(positionInitiale)) points.push(positionInitiale);

  for (const collecte of collectes) {
    const depart = pointDepartCollecte(collecte);
    if (pointValide(depart)) points.push(depart);
    if (pointValide(collecte.localisationArrivee)) {
      points.push(collecte.localisationArrivee);
    }
  }

  return points;
}

/**
 * Prépare les facteurs utilisés par le modèle prédictif de durée.
 */
function extraireCaracteristiquesDuree(
  collecte,
  {
    dureeRoutiereMinutes,
    distanceRouteKm = collecte.distanceKm || 0,
    collectesActivesTransporteur = 0,
    ponctualiteTransporteur = 0.8,
    maintenant = new Date()
  } = {}
) {
  const dateCollecte = collecte.dateCollectePrevue
    ? new Date(collecte.dateCollectePrevue)
    : maintenant;
  const heure = dateCollecte.getHours();
  const jour = dateCollecte.getDay();
  const urgence = collecte.donation?.urgence || collecte.urgence;

  return {
    dureeRoutiereMinutes,
    distanceRouteKm,
    heurePointe: (heure >= 7 && heure <= 9) || (heure >= 16 && heure <= 19),
    weekend: jour === 0 || jour === 6,
    urgenceElevee: urgence === 'ELEVEE',
    urgenceMoyenne: urgence === 'MOYENNE',
    collectesActivesTransporteur,
    ponctualiteTransporteur,
    ponctualiteFaible: ponctualiteTransporteur < 0.8,
    distanceLongue: distanceRouteKm > 10
  };
}

/**
 * Modèle prédictif local de durée. Il joue le rôle d'une première régression
 * entraînable : les coefficients peuvent être remplacés par un modèle appris
 * sur l'historique tunisien lorsque le projet collecte assez de données.
 */
function predireDureeCollecteML(collecte, options = {}) {
  const dureeRoutiereMinutes =
    options.dureeRoutiereMinutes ||
    collecte.dureeEstimeeMinutes ||
    estimerDureeMinutes(collecte.distanceKm || 0);
  const caracteristiques = extraireCaracteristiquesDuree(collecte, {
    ...options,
    dureeRoutiereMinutes
  });

  const multiplicateur =
    1 +
    (caracteristiques.heurePointe ? COEFFICIENTS_DUREE_ML.heurePointe : 0) +
    (caracteristiques.weekend ? COEFFICIENTS_DUREE_ML.weekend : 0) +
    (caracteristiques.urgenceElevee
      ? COEFFICIENTS_DUREE_ML.urgenceElevee
      : 0) +
    (caracteristiques.urgenceMoyenne
      ? COEFFICIENTS_DUREE_ML.urgenceMoyenne
      : 0) +
    Math.min(
      0.35,
      caracteristiques.collectesActivesTransporteur *
        COEFFICIENTS_DUREE_ML.missionsActives
    ) +
    (caracteristiques.ponctualiteFaible
      ? COEFFICIENTS_DUREE_ML.ponctualiteFaible
      : 0) +
    (caracteristiques.distanceLongue ? COEFFICIENTS_DUREE_ML.distanceLongue : 0);

  const dureePrediteMinutes = Math.max(
    5,
    Math.round(
      COEFFICIENTS_DUREE_ML.intercept +
        dureeRoutiereMinutes *
          COEFFICIENTS_DUREE_ML.dureeRoutiere *
          multiplicateur
    )
  );

  return {
    modele: 'Regression lineaire locale v1',
    donneesEntrainement:
      'Coefficients initialises pour demo, remplacables par historique tunisien',
    dureePrediteMinutes,
    dureeRoutiereMinutes: Math.round(dureeRoutiereMinutes),
    ecartMinutes: dureePrediteMinutes - Math.round(dureeRoutiereMinutes),
    caracteristiques: {
      heurePointe: caracteristiques.heurePointe,
      weekend: caracteristiques.weekend,
      urgenceElevee: caracteristiques.urgenceElevee,
      collectesActivesTransporteur:
        caracteristiques.collectesActivesTransporteur,
      ponctualiteTransporteur: arrondir(
        caracteristiques.ponctualiteTransporteur
      ),
      distanceRouteKm: arrondir(caracteristiques.distanceRouteKm, 1)
    }
  };
}

/**
 * Convertit une durée prédite en risque métier de retard avec niveau et raisons.
 */
function predireRetardML(collecte, options = {}) {
  const prediction = predireDureeCollecteML(collecte, options);
  const maintenant = options.maintenant || new Date();
  const livraisonPrevue = collecte.dateLivraisonPrevue
    ? new Date(collecte.dateLivraisonPrevue)
    : null;
  const margeMinutes = livraisonPrevue
    ? Math.round((livraisonPrevue - maintenant) / 60000) -
      prediction.dureePrediteMinutes
    : null;

  let risque = 0.2;
  const raisons = [];
  if (!collecte.transporteur || collecte.statut === 'A_ASSIGNER') {
    risque += 0.25;
    raisons.push('Transporteur non assigne');
  }
  if (margeMinutes !== null) {
    if (margeMinutes < 0) {
      risque += Math.min(0.45, 0.25 + Math.abs(margeMinutes) / 180);
      raisons.push('Duree ML predite apres l echeance');
    } else if (margeMinutes < 30) {
      risque += 0.18;
      raisons.push('Marge inferieure a 30 minutes');
    }
  }
  if (prediction.caracteristiques.heurePointe) {
    risque += 0.12;
    raisons.push('Collecte prevue en heure de pointe');
  }
  if (prediction.caracteristiques.collectesActivesTransporteur > 1) {
    risque += 0.1;
    raisons.push('Transporteur deja charge');
  }
  if (prediction.caracteristiques.ponctualiteTransporteur < 0.8) {
    risque += 0.12;
    raisons.push('Ponctualite historique faible');
  }

  risque = borner(risque);
  const niveau =
    risque >= 0.7 ? 'CRITIQUE' : risque >= 0.4 ? 'ATTENTION' : 'FAIBLE';

  return {
    modele: prediction.modele,
    score: arrondir(risque),
    pourcentage: Math.round(risque * 100),
    niveau,
    margeMinutes,
    dureePrediteMinutes: prediction.dureePrediteMinutes,
    raisons: raisons.length ? raisons : ['Aucun facteur ML de retard important'],
    prediction
  };
}

/**
 * Construit une tournée par choix glouton : à chaque étape, la prochaine
 * collecte est celle qui maximise proximité, urgence et échéance.
 *
 * @returns {object} Ordre proposé, distances avant/après et durée estimée.
 */
function optimiserOrdreCollectes(
  collectes,
  positionInitiale,
  maintenant = new Date()
) {
  const restantes = [...collectes];
  const ordre = [];
  let position = positionInitiale;

  while (restantes.length) {
    const candidates = restantes.map((collecte) => {
      const depart = pointDepartCollecte(collecte);
      const distanceApprocheKm =
        position && depart ? calculerDistanceKm(position, depart) : 0;
      const proximite = borner(1 - distanceApprocheKm / 30);
      const urgence = scoreUrgence(collecte.donation?.urgence);
      const echeance = scoreEcheance(
        collecte.dateLivraisonPrevue || collecte.dateCollectePrevue,
        maintenant
      );
      const score = proximite * 0.45 + urgence * 0.35 + echeance * 0.2;

      return {
        collecte,
        score,
        criteres: { proximite, urgence, echeance },
        distanceApprocheKm
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    const meilleure = candidates[0];
    ordre.push(meilleure);
    restantes.splice(restantes.indexOf(meilleure.collecte), 1);
    position =
      meilleure.collecte.localisationArrivee ||
      pointDepartCollecte(meilleure.collecte) ||
      position;
  }

  const ordreInitial = [...collectes].sort(
    (a, b) => new Date(a.dateCollectePrevue) - new Date(b.dateCollectePrevue)
  );
  const distanceInitialeKm = distanceSequence(ordreInitial, positionInitiale);
  const distanceOptimiseeKm = distanceSequence(
    ordre.map(({ collecte }) => collecte),
    positionInitiale
  );

  return {
    ordre,
    distanceInitialeKm,
    distanceOptimiseeKm,
    gainDistanceKm: arrondir(
      Math.max(0, distanceInitialeKm - distanceOptimiseeKm),
      1
    ),
    dureeEstimeeMinutes: estimerDureeMinutes(distanceOptimiseeKm)
  };
}

/**
 * Optimise une tournée avec de vraies distances routières OSRM et enrichit le
 * résultat par une prédiction ML de durée/retard. En cas d'échec OSRM, le
 * fallback garde l'ancienne optimisation locale.
 */
async function optimiserItineraireRoutierML(
  collectes,
  positionInitiale,
  {
    fetchImpl = globalThis.fetch,
    statistiquesParCollecte = new Map(),
    maintenant = new Date()
  } = {}
) {
  try {
    const ordreCollectes = await optimiserOrdrePickupOsrm(
      collectes,
      positionInitiale,
      { fetchImpl }
    );
    const pointsOptimises = construirePointsTournee(
      ordreCollectes,
      positionInitiale
    );
    const pointsInitiaux = construirePointsTournee(
      [...collectes].sort(
        (a, b) =>
          new Date(a.dateCollectePrevue) - new Date(b.dateCollectePrevue)
      ),
      positionInitiale
    );
    const [routeOptimisee, routeInitiale] = await Promise.all([
      calculerRouteOsrm(pointsOptimises, { fetchImpl }),
      calculerRouteOsrm(pointsInitiaux, { fetchImpl })
    ]);
    const dureeParCollecte = Math.max(
      1,
      Math.round(routeOptimisee.dureeMinutes / ordreCollectes.length)
    );

    return {
      sourceRouting: 'OSRM',
      methode: 'OSRM Trip + modele ML de duree',
      distanceInitialeKm: routeInitiale.distanceKm,
      distanceOptimiseeKm: routeOptimisee.distanceKm,
      gainDistanceKm: arrondir(
        Math.max(0, routeInitiale.distanceKm - routeOptimisee.distanceKm),
        1
      ),
      dureeRouteMinutes: routeOptimisee.dureeMinutes,
      polyline: routeOptimisee.polyline,
      ordreOptimise: ordreCollectes.map((collecte, index) => {
        const stats = statistiquesParCollecte.get(String(collecte._id)) || {};
        const prediction = predireDureeCollecteML(collecte, {
          ...stats,
          dureeRoutiereMinutes: dureeParCollecte,
          distanceRouteKm: routeOptimisee.distanceKm / ordreCollectes.length,
          maintenant
        });

        return {
          ordre: index + 1,
          collecte,
          dureePrediteMinutes: prediction.dureePrediteMinutes,
          prediction
        };
      })
    };
  } catch (error) {
    const fallback = optimiserOrdreCollectes(collectes, positionInitiale, maintenant);
    return {
      sourceRouting: 'FALLBACK_LOCAL',
      methode: 'Fallback local sans OSRM',
      raisonFallback: error.message,
      distanceInitialeKm: fallback.distanceInitialeKm,
      distanceOptimiseeKm: fallback.distanceOptimiseeKm,
      gainDistanceKm: fallback.gainDistanceKm,
      dureeRouteMinutes: fallback.dureeEstimeeMinutes,
      polyline: null,
      ordreOptimise: fallback.ordre.map(({ collecte }, index) => {
        const stats = statistiquesParCollecte.get(String(collecte._id)) || {};
        const prediction = predireDureeCollecteML(collecte, {
          ...stats,
          dureeRoutiereMinutes: fallback.dureeEstimeeMinutes,
          maintenant
        });

        return {
          ordre: index + 1,
          collecte,
          dureePrediteMinutes: prediction.dureePrediteMinutes,
          prediction
        };
      })
    };
  }
}

/**
 * Produit un risque de retard explicable en cumulant les facteurs métier :
 * assignation, échéances, ponctualité, charge active et fraîcheur du GPS.
 *
 * @returns {object} Score, pourcentage, niveau, marge et raisons détaillées.
 */
function evaluerRisqueRetard(
  collecte,
  {
    ponctualiteTransporteur = 0.8,
    collectesActivesTransporteur = 0,
    maintenant = new Date()
  } = {}
) {
  let risque = 0;
  const raisons = [];

  if (collecte.statut === 'A_ASSIGNER' || !collecte.transporteur) {
    risque += 0.3;
    raisons.push('Aucun transporteur assigné');
  }

  const collectePrevue = collecte.dateCollectePrevue
    ? new Date(collecte.dateCollectePrevue)
    : null;
  if (
    collectePrevue &&
    collectePrevue < maintenant &&
    ['A_ASSIGNER', 'PLANIFIEE'].includes(collecte.statut)
  ) {
    risque += 0.35;
    raisons.push('Heure de collecte prévue dépassée');
  }

  const facteurRestant = {
    A_ASSIGNER: 1.35,
    PLANIFIEE: 1,
    EN_ROUTE: 0.6,
    COLLECTEE: 0.25
  }[collecte.statut] || 0;
  const minutesRestantes =
    (collecte.dureeEstimeeMinutes || 0) * facteurRestant;
  const livraisonPrevue = collecte.dateLivraisonPrevue
    ? new Date(collecte.dateLivraisonPrevue)
    : null;
  let margeMinutes = null;

  if (livraisonPrevue) {
    margeMinutes =
      (livraisonPrevue - maintenant) / 60000 - minutesRestantes;
    if (margeMinutes < 0) {
      risque += Math.min(0.4, 0.2 + Math.abs(margeMinutes) / 240);
      raisons.push('Livraison prédite après l’échéance');
    } else if (margeMinutes < 30) {
      risque += 0.15;
      raisons.push('Marge de livraison inférieure à 30 minutes');
    }
  }

  const penaliteHistorique = (1 - borner(ponctualiteTransporteur)) * 0.25;
  risque += penaliteHistorique;
  if (ponctualiteTransporteur < 0.8) {
    raisons.push('Historique de ponctualité du transporteur faible');
  }

  if (collectesActivesTransporteur > 1) {
    risque += Math.min(0.15, (collectesActivesTransporteur - 1) * 0.05);
    raisons.push(`${collectesActivesTransporteur} missions actives`);
  }

  if (collecte.statut === 'EN_ROUTE' && collecte.dernierePositionAt) {
    const minutesSansGps =
      (maintenant - new Date(collecte.dernierePositionAt)) / 60000;
    if (minutesSansGps > 30) {
      risque += 0.15;
      raisons.push('Position GPS non actualisée depuis plus de 30 minutes');
    }
  }

  risque = borner(risque);
  const niveau = risque >= 0.7 ? 'CRITIQUE' : risque >= 0.4 ? 'ATTENTION' : 'FAIBLE';

  return {
    score: arrondir(risque),
    pourcentage: Math.round(risque * 100),
    niveau,
    margeMinutes:
      margeMinutes === null ? null : Math.round(margeMinutes),
    raisons: raisons.length ? raisons : ['Aucun facteur de retard important']
  };
}

/**
 * Évalue l'adéquation d'un transporteur à une collecte avec quatre critères :
 * proximité, disponibilité, ponctualité et expérience.
 *
 * @returns {object} Score global et détail de chaque critère.
 */
function scorerTransporteur(
  transporteur,
  collecte,
  {
    collectesActives = 0,
    ponctualite = 0.8,
    livraisonsTerminees = 0
  } = {}
) {
  const distanceKm =
    transporteur.localisation && collecte.localisationDepart
      ? calculerDistanceKm(
          transporteur.localisation,
          collecte.localisationDepart
        )
      : 30;
  const proximite = borner(1 - distanceKm / 30);
  const disponibilite = 1 / (1 + collectesActives);
  const experience = borner(livraisonsTerminees / 10);
  const score =
    proximite * 0.35 +
    disponibilite * 0.3 +
    borner(ponctualite) * 0.25 +
    experience * 0.1;
  const raisons = [
    `${arrondir(distanceKm, 1)} km du point de collecte`,
    `${collectesActives} mission(s) active(s)`,
    `${Math.round(ponctualite * 100)}% de ponctualité`,
    `${livraisonsTerminees} livraison(s) terminée(s)`
  ];

  return {
    score: arrondir(score),
    pourcentage: Math.round(score * 100),
    distanceKm: arrondir(distanceKm, 1),
    criteres: {
      proximite: arrondir(proximite),
      disponibilite: arrondir(disponibilite),
      ponctualite: arrondir(ponctualite),
      experience: arrondir(experience)
    },
    raisons
  };
}

module.exports = {
  optimiserOrdreCollectes,
  optimiserItineraireRoutierML,
  evaluerRisqueRetard,
  predireDureeCollecteML,
  predireRetardML,
  scorerTransporteur
};
