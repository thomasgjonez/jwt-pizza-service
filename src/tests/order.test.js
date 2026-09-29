const { app, request, loginAdmin, registerDiner } = require('./testUtils');

let adminToken;
let dinerToken;
let crustyMenuItem;

beforeAll(async () => {
  ({ token: adminToken } = await loginAdmin());
  ({ token: dinerToken } = await registerDiner());

  const addRes = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Crusty', description: 'A dry mouthed favorite', image: 'pizza4.png', price: 0.0028 });
  crustyMenuItem = addRes.body.find((item) => item.title === 'Crusty');
});

test('get menu as registered user', async () => {
  const menuRes = await request(app)
    .get('/api/order/menu')
    .set('Authorization', `Bearer ${dinerToken}`);
  expect(menuRes.status).toBe(200);
  expect(menuRes.body).toContainEqual(expect.objectContaining({ title: 'Crusty' }));
});

test('add menu item forbidden for diner', async () => {
  const addRes = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send({ title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 });
  expect(addRes.status).toBe(403);
});

test('get orders for authenticated user', async () => {
  const ordersRes = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${dinerToken}`);
  expect(ordersRes.status).toBe(200);
  expect(ordersRes.body).toMatchObject({ orders: [], page: 1 });
});

test('get orders unauthorized', async () => {
  const ordersRes = await request(app).get('/api/order');
  expect(ordersRes.status).toBe(401);
});

test('create order succeeds when factory accepts it', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reportUrl: 'https://factory.example/report', jwt: 'factory-jwt' }),
  });

  try {
    const orderRes = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: crustyMenuItem.id, description: 'Crusty', price: 0.0028 }],
      });
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.order.items[0].menuId).toBe(crustyMenuItem.id);
    expect(orderRes.body.jwt).toBe('factory-jwt');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('create order returns 500 when factory rejects it', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ reportUrl: 'https://factory.example/report' }),
  });

  try {
    const orderRes = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: crustyMenuItem.id, description: 'Crusty', price: 0.0028 }],
      });
    expect(orderRes.status).toBe(500);
    expect(orderRes.body.message).toBe('Failed to fulfill order at factory');
  } finally {
    global.fetch = originalFetch;
  }
});

