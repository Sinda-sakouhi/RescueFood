const express = require('express');
const {
  listCollectes,
  getCollecte,
  listTransporteurs,
  createCollecte,
  assignerTransporteur,
  updateStatut,
  updatePosition,
  dashboard,
  carte,
  rapportPdf
} = require('../controllers/logistiqueController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get(
  '/dashboard',
  authorizeRoles('ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'),
  dashboard
);
router.get(
  '/carte',
  authorizeRoles('ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'),
  carte
);
router.get(
  '/rapport.pdf',
  authorizeRoles('ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'),
  rapportPdf
);
router.get('/transporteurs', authorizeRoles('ADMIN'), listTransporteurs);
router.get(
  '/collectes',
  authorizeRoles('ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'),
  listCollectes
);
router.get(
  '/collectes/:id',
  authorizeRoles('ADMIN', 'TRANSPORTEUR', 'FOURNISSEUR', 'ONG'),
  getCollecte
);
router.post('/collectes', authorizeRoles('ADMIN'), createCollecte);
router.patch(
  '/collectes/:id/assignation',
  authorizeRoles('ADMIN'),
  assignerTransporteur
);
router.patch(
  '/collectes/:id/statut',
  authorizeRoles('ADMIN', 'TRANSPORTEUR'),
  updateStatut
);
router.patch(
  '/collectes/:id/position',
  authorizeRoles('ADMIN', 'TRANSPORTEUR'),
  updatePosition
);

module.exports = router;
