module.exports = {
  preset: "<rootDir>",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@react-native/assets-registry/registry$": "<rootDir>/tests/mocks/assets-registry.ts"
  },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"]
};
