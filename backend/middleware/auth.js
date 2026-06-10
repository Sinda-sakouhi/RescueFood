const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authenticate(request, response, next) {
  try {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return response.status(401).json({
        message: 'Authentification requise'
      });
    }

    const token = authorization.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'rescuefood-api',
      audience: 'rescuefood-web',
      algorithms: ['HS256']
    });

    const user = await User.findById(payload.sub).select('+tokenVersion');

    if (
      !user ||
      user.statutCompte !== 'VALIDE' ||
      user.tokenVersion !== payload.version
    ) {
      return response.status(401).json({
        message: 'Session invalide ou expirée'
      });
    }

    request.user = user;
    return next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return response.status(401).json({
        message: 'Session invalide ou expirée'
      });
    }

    return next(error);
  }
}

function authorizeRoles(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({
        message: 'Vous n’avez pas les droits nécessaires'
      });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles
};
