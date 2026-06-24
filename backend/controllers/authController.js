const User = require('../models/User');
const {
  createAccessToken,
  getDashboardPath,
  toPublicUser
} = require('../utils/auth');

const PUBLIC_ROLES = ['FOURNISSEUR', 'ONG', 'TRANSPORTEUR', 'CITOYEN'];

async function register(request, response, next) {
  try {
    const {
      nom,
      prenom,
      email,
      motDePasse,
      telephone,
      role = 'CITOYEN',
      adresse,
      localisation,
      categorieAssociation
    } = request.body;

    if (
      !nom ||
      !prenom ||
      !email ||
      !motDePasse ||
      !telephone ||
      !adresse
    ) {
      return response.status(400).json({
        message: 'Tous les champs obligatoires doivent être renseignés'
      });
    }

    if (!PUBLIC_ROLES.includes(role)) {
      return response.status(400).json({
        message: 'Rôle invalide pour une inscription publique'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailExists = await User.exists({ email: normalizedEmail });

    if (emailExists) {
      return response.status(409).json({
        message: 'Un compte existe déjà avec cette adresse email'
      });
    }

    const user = await User.create({
      nom,
      prenom,
      email: normalizedEmail,
      motDePasse,
      telephone,
      role,
      adresse,
      localisation,
      categorieAssociation: role === 'ONG' ? (categorieAssociation || 'HUMANITAIRE') : null,
      statutCompte: 'EN_ATTENTE'
    });

    return response.status(201).json({
      message:
        'Compte créé. Un administrateur doit le valider avant la connexion.',
      user: toPublicUser(user)
    });
  } catch (error) {
    return next(error);
  }
}

async function login(request, response, next) {
  try {
    const { email, motDePasse } = request.body;

    if (!email || !motDePasse) {
      return response.status(400).json({
        message: 'Email et mot de passe obligatoires'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select('+motDePasse +tokenVersion');

    const passwordValid =
      user && (await user.comparerMotDePasse(motDePasse));

    if (!passwordValid) {
      return response.status(401).json({
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (user.statutCompte !== 'VALIDE') {
      const messages = {
        EN_ATTENTE: 'Votre compte attend la validation d’un administrateur',
        REFUSE: 'Votre compte a été refusé',
        SUSPENDU: 'Votre compte est suspendu'
      };

      return response.status(403).json({
        message: messages[user.statutCompte] || 'Compte non autorisé',
        statutCompte: user.statutCompte
      });
    }

    user.derniereConnexion = new Date();
    await user.save();

    return response.json({
      message: 'Connexion réussie',
      accessToken: createAccessToken(user),
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      dashboardPath: getDashboardPath(user.role),
      user: toPublicUser(user)
    });
  } catch (error) {
    return next(error);
  }
}

function me(request, response) {
  return response.json({
    user: toPublicUser(request.user),
    dashboardPath: getDashboardPath(request.user.role)
  });
}

async function updateProfile(request, response, next) {
  try {
    const allowedFields = [
      'nom',
      'prenom',
      'telephone',
      'adresse',
      'localisation',
      'avatarUrl'
    ];

    for (const field of allowedFields) {
      if (request.body[field] !== undefined) {
        request.user[field] = request.body[field];
      }
    }

    await request.user.save();

    return response.json({
      message: 'Profil mis à jour',
      user: toPublicUser(request.user)
    });
  } catch (error) {
    return next(error);
  }
}

async function changerMotDePasse(request, response, next) {
  try {
    const { ancien, nouveau } = request.body;

    if (!ancien || !nouveau) {
      return response.status(400).json({ message: 'Ancien et nouveau mot de passe requis' });
    }

    if (nouveau.length < 8) {
      return response.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    const user = await require('../models/User').findById(request.user._id).select('+motDePasse');
    const valide = user && (await user.comparerMotDePasse(ancien));

    if (!valide) {
      return response.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    user.motDePasse = nouveau;
    await user.save();

    return response.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    return next(error);
  }
}

async function logout(request, response, next) {
  try {
    request.user.tokenVersion += 1;
    await request.user.save();

    return response.json({
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  me,
  updateProfile,
  changerMotDePasse,
  logout
};
