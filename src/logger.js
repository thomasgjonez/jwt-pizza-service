const Logger = require("jwt-pizza-logger");
const config = require("./config.js");
const requestContext = require("./requestContext.js");

// jwt-pizza-logger pushes to Grafana (and round-trips through the factory)
// on every single call. During `jest` runs that would mean hundreds of real
// network calls per test suite against production logging infra, so the
// actual network send is skipped whenever we're running under test.
const isTest = process.env.NODE_ENV === "test";

const pizzaLogger = new Logger(config);

const baseSanitize = pizzaLogger.sanitize.bind(pizzaLogger);
pizzaLogger.sanitize = (logData) => {
  let sanitized = baseSanitize(logData);
  sanitized = sanitized.replace(
    /\\"(token|jwt|apiKey|authorization)\\":\s*\\"[^"]*\\"/gi,
    '\\"$1\\": \\"*****\\"'
  );
  return sanitized;
};

function toUserInfo(user) {
  return user ? { id: user.id, email: user.email } : null;
}

// Every log type below shares the same handful of column names (auth, status,
// req, res, user, ip) instead of type-specific ones (query/reqBody/request...),
// so a combined Grafana table ends up with one `req`/`res`/`status` column
// instead of a different one per log type.

//middleware
function httpLogger(req, res, next) {
  const send = res.send;
  res.send = (resBody) => {
    if (!isTest) {
      // req.path is read as Express is unwinding nested routers (apiRouter,
      // authRouter, etc.), each of which strips its own mount prefix off
      // req.url for the duration of its dispatch - so by the time res.send
      // runs deep in a route handler, req.path is often just "/" instead of
      // the real route. req.originalUrl is never rewritten, so it stays
      // correct regardless of nesting.
      const logData = {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        auth: !!req.headers.authorization,
        user: toUserInfo(requestContext.getUser()),
        req: JSON.stringify(req.body),
        res: JSON.stringify(resBody),
        ip: req.ip,
      };
      const level = pizzaLogger.statusToLogLevel(res.statusCode);
      pizzaLogger.log(level, "http", logData);
    }
    res.send = send;
    return res.send(resBody);
  };
  next();
}

// Called from DB.query for every SQL statement executed.
function dbLog(sql) {
  if (isTest) return;
  const safeSql = sql.replace(/password\s*=\s*'[^']*'/gi, "password='*****'");
  pizzaLogger.log("info", "db", {
    req: safeSql,
    user: toUserInfo(requestContext.getUser()),
  });
}

// Called after a call to the pizza factory completes.
function factoryLog({ user, request, response, statusCode }) {
  if (isTest) return;
  pizzaLogger.log("info", "factory", {
    user: toUserInfo(user),
    status: statusCode,
    req: JSON.stringify(request),
    res: JSON.stringify(response),
  });
}

// Called from the top-level Express error handler for unhandled exceptions.
function unhandledError(err) {
  if (isTest) return;
  pizzaLogger.log("error", "unhandledError", {
    res: err.message,
    status: err.statusCode,
  });
}

module.exports = { httpLogger, dbLog, factoryLog, unhandledError };
