const jestExpoPreset = require("jest-expo/jest-preset");

module.exports = {
  ...jestExpoPreset,
  setupFiles: [require.resolve("./tests/jest.form-data"), ...(jestExpoPreset.setupFiles ?? [])]
};
