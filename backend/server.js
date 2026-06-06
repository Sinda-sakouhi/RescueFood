require('dotenv').config({ quiet: true });

const express = require('express');
const connectDB = require('./config/db');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

async function startServer() {
  try {
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
