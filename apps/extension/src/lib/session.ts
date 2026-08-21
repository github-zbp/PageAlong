import type { PanelState } from "../sidepanel/state";

const SESSION_STORAGE_KEY = "pagealong.extension.panel-state";

export async function readPanelState(): Promise<Partial<PanelState> | null> {
  const storage = globalThis.chrome?.storage?.session;
  if (!storage) {
    return null;
  }
  const stored = await storage.get(SESSION_STORAGE_KEY);
  const snapshot = stored[SESSION_STORAGE_KEY];
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  return snapshot as Partial<PanelState>;
}

export async function writePanelState(state: PanelState): Promise<void> {
  const storage = globalThis.chrome?.storage?.session;
  if (!storage) {
    return;
  }
  await storage.set({ [SESSION_STORAGE_KEY]: state });
}

export async function clearPanelState(): Promise<void> {
  const storage = globalThis.chrome?.storage?.session;
  if (!storage) {
    return;
  }
  await storage.remove(SESSION_STORAGE_KEY);
}
