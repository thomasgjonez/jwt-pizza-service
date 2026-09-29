const { app, request, randomName, loginAdmin, registerDiner, login } = require('./testUtils');

let adminToken;
let franchisee;
let outsider;
let franchise;

beforeAll(async () => {
  ({ token: adminToken } = await loginAdmin());
  franchisee = await registerDiner();
  outsider = await registerDiner();
});

test('create franchise forbidden for non-admin', async () => {
  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${franchisee.token}`)
    .send({ name: `pocket-${randomName()}`, admins: [{ email: franchisee.credentials.email }] });
  expect(createRes.status).toBe(403);
});

test('create franchise as admin', async () => {
  const createRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `pocket-${randomName()}`, admins: [{ email: franchisee.credentials.email }] });
  expect(createRes.status).toBe(200);
  expect(createRes.body.admins[0]).toMatchObject({ email: franchisee.credentials.email });
  franchise = createRes.body;

  // Refresh the franchisee's token so it carries the new franchisee role.
  franchisee = { ...franchisee, ...(await login(franchisee.credentials)) };
});

test('list franchises without auth', async () => {
  const listRes = await request(app).get('/api/franchise');
  expect(listRes.status).toBe(200);
  expect(listRes.body.franchises).toEqual(expect.arrayContaining([expect.objectContaining({ id: franchise.id })]));
});

test('get own franchises', async () => {
  const listRes = await request(app)
    .get(`/api/franchise/${franchisee.user.id}`)
    .set('Authorization', `Bearer ${franchisee.token}`);
  expect(listRes.status).toBe(200);
  expect(listRes.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: franchise.id })]));
});

test('non-owner cannot view another user franchises', async () => {
  const listRes = await request(app)
    .get(`/api/franchise/${franchisee.user.id}`)
    .set('Authorization', `Bearer ${outsider.token}`);
  expect(listRes.status).toBe(200);
  expect(listRes.body).toEqual([]);
});

test('franchisee can create a store', async () => {
  const storeRes = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set('Authorization', `Bearer ${franchisee.token}`)
    .send({ franchiseId: franchise.id, name: 'SLC' });
  expect(storeRes.status).toBe(200);
  expect(storeRes.body).toMatchObject({ franchiseId: franchise.id, name: 'SLC' });
  franchise.store = storeRes.body;
});

test('outsider cannot create a store', async () => {
  const storeRes = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set('Authorization', `Bearer ${outsider.token}`)
    .send({ franchiseId: franchise.id, name: 'Provo' });
  expect(storeRes.status).toBe(403);
});

test('franchisee can delete a store', async () => {
  const deleteRes = await request(app)
    .delete(`/api/franchise/${franchise.id}/store/${franchise.store.id}`)
    .set('Authorization', `Bearer ${franchisee.token}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('store deleted');
});

test('delete franchise', async () => {
  const deleteRes = await request(app).delete(`/api/franchise/${franchise.id}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body.message).toBe('franchise deleted');
});
