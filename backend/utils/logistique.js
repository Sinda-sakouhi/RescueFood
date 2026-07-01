const TRANSITIONS_STATUT = Object.freeze({
  A_ASSIGNER: ['PLANIFIEE', 'ANNULEE'],
  PLANIFIEE: ['EN_ROUTE', 'ANNULEE'],
  EN_ROUTE: ['COLLECTEE', 'ANNULEE'],
  COLLECTEE: ['LIVREE', 'ANNULEE'],
  LIVREE: [],
  ANNULEE: []
});

/**
 * Vérifie qu'un changement respecte le workflow logistique défini.
 *
 * @param {string} statutActuel Statut enregistré en base.
 * @param {string} prochainStatut Statut demandé par l'utilisateur.
 * @returns {boolean} Vrai lorsque la transition est autorisée.
 */
function peutTransitionner(statutActuel, prochainStatut) {
  return (TRANSITIONS_STATUT[statutActuel] || []).includes(prochainStatut);
}

/**
 * Retourne les actions encore possibles depuis un statut donné.
 *
 * @param {string} statutActuel Statut de la collecte.
 * @returns {string[]} Liste des statuts suivants autorisés.
 */
function prochainsStatuts(statutActuel) {
  return TRANSITIONS_STATUT[statutActuel] || [];
}

/**
 * Calcule la distance à vol d'oiseau entre deux coordonnées GPS avec la
 * formule de Haversine.
 *
 * @param {object} depart Coordonnées latitude/longitude du départ.
 * @param {object} arrivee Coordonnées latitude/longitude de l'arrivée.
 * @returns {number} Distance arrondie au dixième de kilomètre.
 */
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

/**
 * Estime une durée de trajet à partir d'une vitesse urbaine moyenne de
 * 24 km/h, avec un minimum de dix minutes.
 *
 * @param {number} distanceKm Distance du trajet en kilomètres.
 * @returns {number} Durée estimée en minutes.
 */
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
