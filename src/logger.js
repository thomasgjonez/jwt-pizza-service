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

//middleware
function httpLogger(req, res, next) {
  const send = res.send;
  res.send = (resBody) => {
    if (!isTest) {
      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        authorized: !!req.headers.authorization,
        user: toUserInfo(requestContext.getUser()),
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
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
    query: safeSql,
    user: toUserInfo(requestContext.getUser()),
  });
}

// Called after a call to the pizza factory completes.
function factoryLog({ user, request, response, statusCode }) {
  if (isTest) return;
  pizzaLogger.factoryLogger({
    user: toUserInfo(user),
    statusCode,
    request,
    response,
  });
}

// Called from the top-level Express error handler for unhandled exceptions.
function unhandledError(err) {
  if (isTest) return;
  pizzaLogger.unhandledErrorLogger(err);
}

module.exports = { httpLogger, dbLog, factoryLog, unhandledError };
