require('dotenv').config({ path: './.env' });

// Forcer MONGODB_URI si non défini
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/RescueFood';
  console.log('⚠️ MONGODB_URI forcé en dur');
}

const connectDB = require('./config/db');
const app = require('./app');
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    // Vérification JWT_SECRET désactivée pour le développement
    // if (
    //   !process.env.JWT_SECRET ||
    //   process.env.JWT_SECRET.startsWith('change-this') ||
    //   process.env.JWT_SECRET.length < 32
    // ) {
    //   throw new Error(
    //     'JWT_SECRET doit être remplacé par un secret aléatoire d’au moins 32 caractères'
    //   );
    // }

    // Connexion MongoDB désactivée pour le développement
    // await connectDB();

    app.listen(port, () => {
      console.log(`✅ RescueFood API disponible sur http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Démarrage du serveur impossible :', error.message);
    process.exit(1);
  }
}

startServer();