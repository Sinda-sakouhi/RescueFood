const express = require('express');
const {
  listDonations,
  getDonation,
  createDonation,
  updateDonation,
  updateDonationStatut,
  deleteDonation
} = require('../controllers/donationController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes accessibles à tous les utilisateurs authentifiés
router.get('/', listDonations);
router.get('/:id', getDonation);

// Routes réservées aux fournisseurs
router.post('/', authorizeRoles('FOURNISSEUR'), createDonation);

// Routes pour modification et suppression (fournisseur du don ou admin)
router.put('/:id', authorizeRoles('FOURNISSEUR', 'ADMIN'), updateDonation);
router.delete('/:id', authorizeRoles('FOURNISSEUR', 'ADMIN'), deleteDonation);

// Route pour changement de statut (admin, ONG, transporteur)
router.patch(
  '/:id/statut',
  authorizeRoles('ADMIN', 'ONG', 'TRANSPORTEUR'),
  updateDonationStatut
);

module.exports = router;
