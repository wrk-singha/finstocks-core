export interface UserMemoryDocument {
  memory_text: string;
  version: number;
  updated_at: string | null;
}

export interface UpdateUserMemoryRequest {
  memory_text: string;
  expected_version: number;
}

/** The 409 body when `expected_version` is stale; `current` is what to rebase onto. */
export interface MemoryVersionConflict {
  error: 'memory version conflict';
  current: UserMemoryDocument;
}

export interface MemoryConfirmationRequest {
  confirmation: 'RESET_LEARNED_BEHAVIOR' | 'DELETE_MY_MEMORY';
}
