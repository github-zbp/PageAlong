jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

jest.mock("@/lib/auth-storage", () => ({
  loadAuthToken: jest.fn(),
  saveAuthToken: jest.fn(),
  clearAuthToken: jest.fn()
}));

jest.mock("@/lib/api", () => ({
  getCurrentUser: jest.fn()
}));

import { bootstrapSession } from "@/lib/session";
import { loadAuthToken } from "@/lib/auth-storage";

it("boots to signed out when no token exists", async () => {
  (loadAuthToken as jest.Mock).mockResolvedValueOnce(null);

  await expect(bootstrapSession()).resolves.toMatchObject({
    status: "signed_out",
    token: null,
    user: null
  });
});
