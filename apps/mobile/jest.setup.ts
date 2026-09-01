import "@testing-library/jest-native/extend-expect";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

beforeEach(async () => {
  const asyncStorageModule = require("@react-native-async-storage/async-storage");
  const AsyncStorage = asyncStorageModule.default ?? asyncStorageModule;
  if (typeof AsyncStorage.clear === "function") {
    await AsyncStorage.clear();
  }
  require("./src/lib/locale").resetLocalePreferenceForTests();
});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  return {
    Feather: (props: unknown) => React.createElement("Feather", props)
  };
});
