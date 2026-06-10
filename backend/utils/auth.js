const jwt = require('jsonwebtoken');

const DASHBOARD_PATHS = {
  ADMIN: '/admin/dashboard',
  FOURNISSEUR: '/fournisseur/dashboard',
  ONG: '/ong/dashboard',
  TRANSPORTEUR: '/transporteur/dashboard',
  CITOYEN: '/citoyen/dashboard'
};

function createAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('La variable JWT_SECRET est absente du fichier .env');
  }

  return jwt.sign(
    {
      role: user.role,
      version: user.tokenVersion
    },
    process.env.JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: 'rescuefood-api',
      audience: 'rescuefood-web',
      algorithm: 'HS256'
    }
  );
}

function getDashboardPath(role) {
  return DASHBOARD_PATHS[role] || '/';
}

function toPublicUser(user) {
  return {
    id: user._id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    telephone: user.telephone,
    role: user.role,
    adresse: user.adresse,
    localisation: user.localisation,
    statutCompte: user.statutCompte,
    avatarUrl: user.avatarUrl,
    emailVerifie: user.emailVerifie,
    derniereConnexion: user.derniereConnexion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

module.exports = {
  createAccessToken,
  getDashboardPath,
  toPublicUser
};
