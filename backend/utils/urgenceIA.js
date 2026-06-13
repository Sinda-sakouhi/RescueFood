function calculerUrgence(dateExpiration) {
  const maintenant = new Date();
  const expiration = new Date(dateExpiration);
  const heuresRestantes = (expiration - maintenant) / (1000 * 60 * 60);

  if (heuresRestantes <= 6) {
    return {
      urgence: 'ELEVEE',
      raison: 'Expire dans moins de 6 heures',
      score: 1.0
    };
  } else if (heuresRestantes <= 24) {
    return {
      urgence: 'ELEVEE',
      raison: 'Expire dans moins de 24 heures',
      score: 0.8
    };
  } else if (heuresRestantes <= 72) {
    return {
      urgence: 'MOYENNE',
      raison: 'Expire dans moins de 3 jours',
      score: 0.5
    };
  } else {
    return {
      urgence: 'FAIBLE',
      raison: 'Expire dans plus de 3 jours',
      score: 0.2
    };
  }
}

module.exports = { calculerUrgence };
