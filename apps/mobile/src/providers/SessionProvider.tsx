import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { getCurrentUser } from "@/lib/api";
import { bootstrapSession, clearSession, persistSession, type SessionState } from "@/lib/session";

type SessionContextValue = {
  state: SessionState;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: "loading", token: null, user: null });

  useEffect(() => {
    let active = true;
    void bootstrapSession().then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const signInWithToken = useCallback(async (token: string) => {
    await persistSession(token);
    try {
      const user = await getCurrentUser();
      setState({ status: "signed_in", token, user });
    } catch (error) {
      await clearSession();
      setState({ status: "signed_out", token: null, user: null });
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setState({ status: "signed_out", token: null, user: null });
  }, []);

  const refresh = useCallback(async () => {
    setState(await bootstrapSession());
  }, []);

  const value = useMemo(
    () => ({
      state,
      signInWithToken,
      signOut,
      refresh
    }),
    [state, signInWithToken, signOut, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
