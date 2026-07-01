const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');

async function avecServeur(callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('un corps texte est refusé avec une erreur 415 explicite', async () => {
  await avecServeur(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        email: 'admin@rescuefood.demo',
        motDePasse: 'Demo1234!'
      })
    });
    const body = await response.json();

    assert.equal(response.status, 415);
    assert.match(body.message, /application\/json/);
  });
});

test('un JSON mal formé est refusé avec une erreur 400', async () => {
  await avecServeur(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":'
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(
      body.message,
      'Le corps de la requête contient un JSON invalide'
    );
  });
});
