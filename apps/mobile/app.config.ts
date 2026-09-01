import type { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "PageAlong",
  slug: "pagealong",
  scheme: "pagealong",
  orientation: "portrait",
  platforms: ["android"],
  android: {
    package: "com.pagealong.app"
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8070",
    "eas": {
      "projectId": "b1978889-b9c5-4d6b-aa35-07941f8db37c"
    }
  },
  plugins: [
    "expo-router",
    [
      "expo-sharing",
      {
        android: {
          enabled: true,
          singleShareMimeTypes: ["text/plain", "text/uri-list"],
          multipleShareMimeTypes: ["text/plain", "text/uri-list"]
        }
      }
    ],
    "expo-secure-store",
    [
      "expo-audio",
      {
        enableBackgroundPlayback: true,
        recordAudioAndroid: false
      }
    ]
  ]
});
