jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

import { clearAuthToken, loadAuthToken, saveAuthToken } from "@/lib/auth-storage";
import * as SecureStore from "expo-secure-store";

it("stores and clears the auth token", async () => {
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValueOnce(undefined);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("token-123");
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValueOnce(undefined);

  await saveAuthToken("token-123");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("pagealong.auth.token", "token-123");

  await expect(loadAuthToken()).resolves.toBe("token-123");

  await clearAuthToken();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("pagealong.auth.token");
});
