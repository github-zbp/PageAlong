require("whatwg-fetch");

const RNFormData = require("react-native/Libraries/Network/FormData").default;
const { installFormDataPatch } = require("expo/src/winter/FormData");

if (typeof globalThis.FormData === "undefined") {
  globalThis.FormData = installFormDataPatch(RNFormData);
}
