module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['json-summary', 'text', 'lcov'],
  collectCoverageFrom: ['src/**/*.js', '!src/tests/**', '!src/index.js', '!src/init.js', '!src/config.js'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
};
