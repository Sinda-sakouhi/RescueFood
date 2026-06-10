const mongoose = require('mongoose');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Annonce = require('../models/Annonce');
const Collecte = require('../models/Collecte');

const ROLES = ['ADMIN', 'FOURNISSEUR', 'ONG', 'TRANSPORTEUR', 'CITOYEN'];
const STATUTS = ['EN_ATTENTE', 'VALIDE', 'REFUSE', 'SUSPENDU'];

async function dashboard(request, response, next) {
  try {
    const [
      totalUsers,
      usersByRole,
      usersByStatus,
      totalDonations,
      totalAnnonces,
      totalCollectes
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 } } }]),
      User.aggregate([
        { $group: { _id: '$statutCompte', total: { $sum: 1 } } }
      ]),
      Donation.countDocuments(),
      Annonce.countDocuments(),
      Collecte.countDocuments()
    ]);

    return response.json({
      utilisateurs: {
        total: totalUsers,
        parRole: usersByRole,
        parStatut: usersByStatus
      },
      donations: totalDonations,
      annonces: totalAnnonces,
      collectes: totalCollectes
    });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(request, response, next) {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('-__v');

    return response.json({ users });
  } catch (error) {
    return next(error);
  }
}

async function updateUserAccess(request, response, next) {
  try {
    const { role, statutCompte } = request.body;

    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    if (role !== undefined && !ROLES.includes(role)) {
      return response.status(400).json({ message: 'Rôle invalide' });
    }

    if (statutCompte !== undefined && !STATUTS.includes(statutCompte)) {
      return response.status(400).json({ message: 'Statut invalide' });
    }

    const user = await User.findById(request.params.id).select('+tokenVersion');

    if (!user) {
      return response.status(404).json({ message: 'Utilisateur introuvable' });
    }

    if (
      user._id.equals(request.user._id) &&
      ((role && role !== 'ADMIN') ||
        (statutCompte && statutCompte !== 'VALIDE'))
    ) {
      return response.status(400).json({
        message: 'Un administrateur ne peut pas retirer son propre accès'
      });
    }

    if (role !== undefined) {
      user.role = role;
    }

    if (statutCompte !== undefined) {
      user.statutCompte = statutCompte;
    }

    user.tokenVersion += 1;
    await user.save();

    return response.json({
      message: 'Accès utilisateur mis à jour',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        statutCompte: user.statutCompte
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  listUsers,
  updateUserAccess
};
