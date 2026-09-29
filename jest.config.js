module.exports = {
  testEnvironment: 'node',
  // Test files each get their own DB module instance and hit the same real
  // MySQL database. On a fresh database, running files in parallel races
  // multiple processes to create the schema/default admin user at once.
  // Running serially avoids that.
  maxWorkers: 1,
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text', 'lcov'],
  collectCoverageFrom: ['src/**/*.js', '!src/tests/**', '!src/index.js', '!src/init.js', '!src/config.js'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
