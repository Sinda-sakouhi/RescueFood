const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

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
