/**
 * SEBI's F&O risk disclosure is a per-session acknowledgement: shown once when the user first
 * opens the F&O tab, then not again for the life of the session. Never persisted across
 * launches — that would make it a one-time acceptance, and a disclosure the user agreed to
 * months ago is not a disclosure.
 *
 * What "session" means is the host's call: on a phone the app process is the session, so the
 * default in-memory flag is right; in a browser a tab is, and a reload must not re-fire the
 * gate, so the web installs a sessionStorage-backed store through `setFnoRiskStore`.
 */
export interface FnoRiskStore {
  get(): boolean;
  set(): void;
}

let accepted = false;

const memoryStore: FnoRiskStore = {
  get: () => accepted,
  set: () => {
    accepted = true;
  },
};

let store: FnoRiskStore = memoryStore;

/** Swap the backing store; `null` restores the in-memory default. Storage failures are the
 *  store's to swallow — a gate that throws is worse than one that shows again. */
export function setFnoRiskStore(next: FnoRiskStore | null): void {
  store = next ?? memoryStore;
}

export function hasAcceptedFnoRisk(): boolean {
  try {
    return store.get();
  } catch {
    return false;
  }
}

export function acceptFnoRisk(): void {
  try {
    store.set();
  } catch {
    // Private-mode / storage-disabled: the gate simply shows again.
  }
}
