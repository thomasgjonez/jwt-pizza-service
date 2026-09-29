const request = require("supertest");
const app = require("../service");
const { randomName } = require("./testUtils");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = randomName() + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
});

test("register", async () => {
  const newUser = { name: "new diner", email: `${randomName()}@test.com`, password: "a" };
  const registerRes = await request(app).post("/api/auth").send(newUser);
  expect(registerRes.status).toBe(200);
  expect(registerRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
  expect(registerRes.body.user).toMatchObject({
    name: newUser.name,
    email: newUser.email,
    roles: [{ role: "diner" }],
  });
});

test("register missing fields", async () => {
  const registerRes = await request(app)
    .post("/api/auth")
    .send({ email: "nobody@test.com" });
  expect(registerRes.status).toBe(400);
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );

  expect(loginRes.body.user).toMatchObject({
    name: testUser.name,
    email: testUser.email,
    roles: [{ role: "diner" }],
  });
});

test("login with wrong password", async () => {
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: testUser.email, password: "wrong" });
  expect(loginRes.status).toBe(404);
});

test("logout", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");

  const meRes = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(meRes.status).toBe(401);
});

