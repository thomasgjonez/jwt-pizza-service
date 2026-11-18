const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

function middleware(req, res, next) {
  storage.run({ user: req.user ?? null }, next);
}

function getUser() {
  return storage.getStore()?.user ?? null;
}

module.exports = { middleware, getUser };
