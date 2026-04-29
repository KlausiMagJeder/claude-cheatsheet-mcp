export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  // 10 s global timeout — required for integration tests that spawn a child
  // process (cold-start + initial index scan can take ~1–3 s on slow machines).
  testTimeout: 10000,
  // WARUM testPathIgnorePatterns: Seit Task 20 werden Tests von tsc nach
  // dist/__tests__ mitkompiliert. Ohne diesen Ignore würde Jest die
  // compiled .js/.d.ts-Varianten parallel zu den .ts-Sources laden
  // und reihenweise „Test suite must contain at least one test"-Fehler
  // werfen sowie doppelt ausführen.
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { useESM: true },
    ],
  },
};
