require('dotenv').config({ quiet: true });

const connectDB = require('./config/db');
const app = require('./app');
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.startsWith('change-this') ||
      process.env.JWT_SECRET.length < 32
    ) {
      throw new Error(
        'JWT_SECRET doit être remplacé par un secret aléatoire d’au moins 32 caractères'
      );
    }

    await connectDB();

    app.listen(port, () => {
      console.log(`RescueFood API disponible sur http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Démarrage du serveur impossible :', error.message);
    process.exit(1);
  }
}

startServer();
