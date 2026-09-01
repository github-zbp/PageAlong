jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      clear: jest.fn(async () => {
        store.clear();
      })
    }
  };
});

import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  bootstrapLocalePreference,
  resetLocalePreferenceForTests,
  setLocalePreference,
  useLocalePreference
} from "@/lib/locale";

function LocaleProbe() {
  const locale = useLocalePreference();
  return <Text>{locale}</Text>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalePreferenceForTests();
});

it("hydrates and shares the persisted app locale", async () => {
  await AsyncStorage.setItem("pagealong.locale", "en");

  const screen = await render(<LocaleProbe />);
  await bootstrapLocalePreference();

  expect(await screen.findByText("en")).toBeTruthy();
});

it("updates every subscriber when the locale changes", async () => {
  const screen = await render(<LocaleProbe />);

  await act(async () => {
    await setLocalePreference("en");
  });

  await waitFor(() => {
    expect(screen.getByText("en")).toBeTruthy();
  });
});
