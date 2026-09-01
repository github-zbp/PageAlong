import { clearAuthToken, loadAuthToken, saveAuthToken } from "@/lib/auth-storage";
import { getCurrentUser, type AuthUser } from "@/lib/api";
import { clearSessionToken, setSessionToken } from "@/lib/session-store";

export type SessionState =
  | { status: "loading"; token: null; user: null }
  | { status: "signed_out"; token: null; user: null }
  | { status: "signed_in"; token: string; user: AuthUser };

export async function bootstrapSession(): Promise<SessionState> {
  const token = await loadAuthToken();
  if (!token) {
    clearSessionToken();
    return { status: "signed_out", token: null, user: null };
  }

  try {
    setSessionToken(token);
    const user = await getCurrentUser();
    return { status: "signed_in", token, user };
  } catch {
    await clearSession();
    return { status: "signed_out", token: null, user: null };
  }
}

export async function persistSession(token: string): Promise<void> {
  setSessionToken(token);
  await saveAuthToken(token);
}

export async function clearSession(): Promise<void> {
  clearSessionToken();
  await clearAuthToken();
}
