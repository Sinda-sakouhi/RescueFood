const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('La variable MONGODB_URI est absente du fichier .env');
  }

  const connection = await mongoose.connect(mongoUri);
  console.log(`MongoDB connecté à la base "${connection.connection.name}"`);

  return connection;
}

module.exports = connectDB;
