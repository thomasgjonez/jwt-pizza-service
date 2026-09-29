const request = require('supertest');
const app = require('../service');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function loginAdmin() {
  const loginRes = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
  return { user: loginRes.body.user, token: loginRes.body.token };
}

async function registerDiner() {
  const newUser = { name: 'pizza diner', email: `${randomName()}@test.com`, password: 'a' };
  const registerRes = await request(app).post('/api/auth').send(newUser);
  return { user: registerRes.body.user, token: registerRes.body.token, credentials: newUser };
}

async function login(credentials) {
  const loginRes = await request(app).put('/api/auth').send(credentials);
  return { user: loginRes.body.user, token: loginRes.body.token };
}

module.exports = { app, request, randomName, loginAdmin, registerDiner, login };
