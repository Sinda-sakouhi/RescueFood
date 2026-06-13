const TRANSITIONS_STATUT = Object.freeze({
  A_ASSIGNER: ['PLANIFIEE', 'ANNULEE'],
  PLANIFIEE: ['EN_ROUTE', 'ANNULEE'],
  EN_ROUTE: ['COLLECTEE', 'ANNULEE'],
  COLLECTEE: ['LIVREE', 'ANNULEE'],
  LIVREE: [],
  ANNULEE: []
});

function peutTransitionner(statutActuel, prochainStatut) {
  return (TRANSITIONS_STATUT[statutActuel] || []).includes(prochainStatut);
}

function prochainsStatuts(statutActuel) {
  return TRANSITIONS_STATUT[statutActuel] || [];
}

function calculerDistanceKm(depart, arrivee) {
  const rayonTerreKm = 6371;
  const radians = (valeur) => (valeur * Math.PI) / 180;
  const deltaLatitude = radians(arrivee.latitude - depart.latitude);
  const deltaLongitude = radians(arrivee.longitude - depart.longitude);
  const latitudeDepart = radians(depart.latitude);
  const latitudeArrivee = radians(arrivee.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeDepart) *
      Math.cos(latitudeArrivee) *
      Math.sin(deltaLongitude / 2) ** 2;

  return (
    Math.round(
      rayonTerreKm *
        2 *
        Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) *
        10
    ) / 10
  );
}

function estimerDureeMinutes(distanceKm) {
  return Math.max(10, Math.round((distanceKm / 24) * 60));
}

module.exports = {
  TRANSITIONS_STATUT,
  peutTransitionner,
  prochainsStatuts,
  calculerDistanceKm,
  estimerDureeMinutes
};
