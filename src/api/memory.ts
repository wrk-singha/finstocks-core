import type {
  MemoryConfirmationRequest,
  UpdateUserMemoryRequest,
  UserMemoryDocument,
} from '../types/memory.ts';
import type {HttpClient} from './http.ts';

/**
 * PUT /memory answers 409 with a `MemoryVersionConflict` body when
 * `expected_version` is stale. Each host surfaces it its own way (the mobile
 * throws `MemoryConflictError`, the web reads the axios error payload) — core
 * only names the shape, in `types/memory.ts`.
 */

/** Web-only: GET here streams the memory document as a file download. */
export const memoryDownloadPath = '/memory/download';

export const memoryApi = (http: HttpClient) => ({
  getMemory: () => http.request<UserMemoryDocument>('/memory'),

  updateMemory: (data: UpdateUserMemoryRequest) =>
    http.request<UserMemoryDocument>('/memory', {method: 'PUT', body: data}),

  resetLearnedBehavior: () =>
    http.request<unknown>('/memory/behavior', {
      method: 'DELETE',
      body: {
        confirmation: 'RESET_LEARNED_BEHAVIOR',
      } satisfies MemoryConfirmationRequest,
    }),

  deleteMemory: () =>
    http.request<unknown>('/memory', {
      method: 'DELETE',
      body: {
        confirmation: 'DELETE_MY_MEMORY',
      } satisfies MemoryConfirmationRequest,
    }),
});

export type MemoryApi = ReturnType<typeof memoryApi>;
