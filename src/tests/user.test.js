const { app, request, loginAdmin, registerDiner } = require('./testUtils');

let dinerA;
let dinerB;
let adminToken;

beforeAll(async () => {
  dinerA = await registerDiner();
  dinerB = await registerDiner();
  ({ token: adminToken } = await loginAdmin());
});

test('get authenticated user', async () => {
  const meRes = await request(app)
    .get('/api/user/me')
    .set('Authorization', `Bearer ${dinerA.token}`);
  expect(meRes.status).toBe(200);
  expect(meRes.body).toMatchObject({ id: dinerA.user.id, email: dinerA.credentials.email });
});

test('update own user', async () => {
  const updateRes = await request(app)
    .put(`/api/user/${dinerA.user.id}`)
    .set('Authorization', `Bearer ${dinerA.token}`)
    .send({ name: 'updated name' });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.user.name).toBe('updated name');
  expect(updateRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
});

test('update another user is forbidden', async () => {
  const updateRes = await request(app)
    .put(`/api/user/${dinerA.user.id}`)
    .set('Authorization', `Bearer ${dinerB.token}`)
    .send({ name: 'hijacked name' });
  expect(updateRes.status).toBe(403);
});

test('admin can update another user', async () => {
  const updateRes = await request(app)
    .put(`/api/user/${dinerB.user.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'admin updated name' });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.user.name).toBe('admin updated name');
});

test('delete user', async () => {
  const deleteRes = await request(app)
    .delete(`/api/user/${dinerA.user.id}`)
    .set('Authorization', `Bearer ${dinerA.token}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('not implemented');
});

test('list users', async () => {
  const listRes = await request(app)
    .get('/api/user')
    .set('Authorization', `Bearer ${dinerA.token}`);
  expect(listRes.status).toBe(200);
  expect(listRes.body).toMatchObject({ users: [], more: false });
});

