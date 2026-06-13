const express = require('express');
const {
  listCategories,
  getCategorie,
  createCategorie,
  updateCategorie,
  deleteCategorie
} = require('../controllers/categorieController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Routes publiques
router.get('/', listCategories);
router.get('/:id', getCategorie);

// Routes protégées (ADMIN uniquement)
router.use(authenticate, authorizeRoles('ADMIN'));
router.post('/', createCategorie);
router.put('/:id', updateCategorie);
router.delete('/:id', deleteCategorie);

module.exports = router;
