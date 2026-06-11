const express = require('express');
const {
  getSuggestions,
  accepterMatching,
  listMatchings,
  refuserMatching
} = require('../controllers/matchingController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/suggestions',
  authenticate,
  authorizeRoles('FOURNISSEUR', 'ONG'),
  getSuggestions
);
router.get('/', authenticate, listMatchings);
router.post(
  '/',
  authenticate,
  authorizeRoles('FOURNISSEUR', 'ONG'),
  accepterMatching
);
router.patch(
  '/:id/refuser',
  authenticate,
  authorizeRoles('FOURNISSEUR', 'ONG'),
  refuserMatching
);

module.exports = router;