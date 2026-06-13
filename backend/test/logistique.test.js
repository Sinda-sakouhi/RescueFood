const test = require('node:test');
const assert = require('node:assert/strict');
const {
  peutTransitionner,
  prochainsStatuts,
  calculerDistanceKm,
  estimerDureeMinutes
} = require('../utils/logistique');

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
