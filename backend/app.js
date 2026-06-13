const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const annonceRoutes = require('./routes/annonceRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const logistiqueRoutes = require('./routes/logistiqueRoutes');
const categorieRoutes = require('./routes/categorieRoutes');
const donationRoutes = require('./routes/donationRoutes');
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (request, response) => {
  response.json({
    status: 'ok',
    service: 'RescueFood API'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/annonces', annonceRoutes);
app.use('/api/matchings', matchingRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/logistique', logistiqueRoutes);
app.use('/api/categories', categorieRoutes);
app.use('/api/donations', donationRoutes);
app.use((request, response) => {
  response.status(404).json({
    message: 'Route introuvable'
  });
});

app.use((error, request, response, next) => {
  console.error(error);

  if (error.name === 'ValidationError') {
    return response.status(400).json({
      message: 'Données invalides',
      errors: Object.values(error.errors).map(({ message }) => message)
    });
  }

  if (error.code === 11000) {
    return response.status(409).json({
      message: 'Une valeur unique existe déjà'
    });
  }

  return response.status(500).json({
    message: 'Erreur interne du serveur'
  });
});

module.exports = app;
