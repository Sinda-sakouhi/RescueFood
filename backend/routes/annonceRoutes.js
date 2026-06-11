const express = require('express');
const {
  listAnnonces,
  getAnnonce,
  createAnnonce,
  updateAnnonce,
  deleteAnnonce,
  mesAnnonces
} = require('../controllers/annonceController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Routes publiques
router.get('/', listAnnonces);
router.get('/:id', getAnnonce);

// Routes protégées
router.get('/user/mes-annonces', authenticate, mesAnnonces);
router.post(
  '/',
  authenticate,
  authorizeRoles('FOURNISSEUR', 'ONG'),
  createAnnonce
);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('FOURNISSEUR', 'ONG'),
  updateAnnonce
);
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('FOURNISSEUR', 'ONG', 'ADMIN'),
  deleteAnnonce
);

module.exports = router;