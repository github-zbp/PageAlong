import { redirectSystemPath } from "../app/+native-intent";

it("redirects expo sharing intents into the share receive route", () => {
  expect(redirectSystemPath({ path: "exp://expo-sharing?foo=1", initial: true })).toBe("/share/receive");
  expect(redirectSystemPath({ path: "/courses/abc", initial: false })).toBe("/courses/abc");
});
