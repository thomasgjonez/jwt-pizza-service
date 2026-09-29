const request = require('supertest');
const app = require('../service');

test('welcome message', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('welcome to JWT Pizza');
  expect(res.body.version).toBeDefined();
});

test('docs endpoint lists all router docs', async () => {
  const res = await request(app).get('/api/docs');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.endpoints)).toBe(true);
  expect(res.body.endpoints.length).toBeGreaterThan(0);
  expect(res.body.config).toMatchObject({ factory: expect.any(String), db: expect.any(String) });
});

test('unknown endpoint returns 404', async () => {
  const res = await request(app).get('/api/does-not-exist');
  expect(res.status).toBe(404);
  expect(res.body.message).toBe('unknown endpoint');
});

test('reflects request origin for CORS', async () => {
  const res = await request(app).get('/').set('Origin', 'https://example.com');
  expect(res.headers['access-control-allow-origin']).toBe('https://example.com');
});
