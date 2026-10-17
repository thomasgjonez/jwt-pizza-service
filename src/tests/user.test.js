const { app, request, loginAdmin, registerDiner } = require("./testUtils");

let dinerA;
let dinerB;
let adminToken;

beforeAll(async () => {
  dinerA = await registerDiner();
  dinerB = await registerDiner();
  ({ token: adminToken } = await loginAdmin());
});

test("get authenticated user", async () => {
  const meRes = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${dinerA.token}`);
  expect(meRes.status).toBe(200);
  expect(meRes.body).toMatchObject({
    id: dinerA.user.id,
    email: dinerA.credentials.email,
  });
});

test("update own user", async () => {
  const updateRes = await request(app)
    .put(`/api/user/${dinerA.user.id}`)
    .set("Authorization", `Bearer ${dinerA.token}`)
    .send({ name: "updated name" });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.user.name).toBe("updated name");
  expect(updateRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
});

test("update another user is forbidden", async () => {
  const updateRes = await request(app)
    .put(`/api/user/${dinerA.user.id}`)
    .set("Authorization", `Bearer ${dinerB.token}`)
    .send({ name: "hijacked name" });
  expect(updateRes.status).toBe(403);
});

test("admin can update another user", async () => {
  const updateRes = await request(app)
    .put(`/api/user/${dinerB.user.id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "admin updated name" });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.user.name).toBe("admin updated name");
});

test("delete user unauthorized", async () => {
  const deleteRes = await request(app).delete(`/api/user/${dinerA.user.id}`);
  expect(deleteRes.status).toBe(401);
});

test("delete user forbidden for non-admin", async () => {
  const target = await registerDiner();
  const deleteRes = await request(app)
    .delete(`/api/user/${target.user.id}`)
    .set("Authorization", `Bearer ${dinerB.token}`);
  expect(deleteRes.status).toBe(403);
});

test("admin can delete a user", async () => {
  const target = await registerDiner();
  const deleteRes = await request(app)
    .delete(`/api/user/${target.user.id}`)
    .set("Authorization", `Bearer ${adminToken}`);
  expect(deleteRes.status).toBe(200);

  const loginRes = await request(app)
    .put("/api/auth")
    .send(target.credentials);
  expect(loginRes.status).toBe(404);
});

// test('list users', async () => {
//   const listRes = await request(app)
//     .get('/api/user')
//     .set('Authorization', `Bearer ${dinerA.token}`);
//   expect(listRes.status).toBe(200);
//   expect(listRes.body).toMatchObject({ users: [], more: false });
// });

// NEED TO FIX LINTING ERROR
test("list users unauthorized", async () => {
  const listUsersRes = await request(app).get("/api/user");
  expect(listUsersRes.status).toBe(401);
});

test("list users", async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: "pizza diner",
    email: `${randomName()}@test.com`,
    password: "a",
  };
  const registerRes = await service.post("/api/auth").send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
