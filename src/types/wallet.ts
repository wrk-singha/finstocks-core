/** How the last nightly broker sync went. Mirrors the Go constants. */
export type WalletSyncStatus =
  'ok' | 'token_expired' | 'not_configured' | 'error';

/**
 * Cash sitting with the user's broker, as of the last sync.
 *
 * `connected: false` means no broker is linked at all — distinct from a linked broker holding
 * ₹0, which the UI has to say differently.
 */
export interface Wallet {
  connected: boolean;
  broker?: string;
  total: number;
  /** Segment split, only populated by brokers that report one (Zerodha, Upstox). */
  equity: number;
  commodity: number;
  used: number;
  /** Absent until the first successful sync. */
  synced_at?: string;
  sync_status?: WalletSyncStatus;
}
