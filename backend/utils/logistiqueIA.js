const { calculerDistanceKm, estimerDureeMinutes } = require('./logistique');

function borner(valeur, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, valeur));
}

function arrondir(valeur, decimales = 2) {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

function heuresAvant(date, maintenant = new Date()) {
  if (!date) return 24;
  return (new Date(date) - maintenant) / 3600000;
}

function scoreUrgence(urgence) {
  return { ELEVEE: 1, MOYENNE: 0.65, FAIBLE: 0.35 }[urgence] || 0.5;
}

function scoreEcheance(date, maintenant) {
  const heures = heuresAvant(date, maintenant);
  if (heures <= 2) return 1;
  if (heures <= 6) return 0.85;
  if (heures <= 12) return 0.7;
  if (heures <= 24) return 0.5;
  return 0.3;
}

function pointDepartCollecte(collecte) {
  if (
    ['EN_ROUTE', 'COLLECTEE'].includes(collecte.statut) &&
    collecte.positionActuelle
  ) {
    return collecte.positionActuelle;
  }
  return collecte.localisationDepart;
}

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
  evaluerRisqueRetard,
  scorerTransporteur
};
