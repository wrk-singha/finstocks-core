import type {
  CustomIndicator,
  RenameCustomIndicatorRequest,
  SaveCustomIndicatorRequest,
} from '../types/customIndicator.ts';
import type {HttpClient} from './http.ts';

/** Go writes an empty slice as null. */
interface CustomIndicatorsWire {
  indicators: CustomIndicator[] | null;
}

const rowPath = (id: string) => `/custom-indicators/${encodeURIComponent(id)}`;

/**
 * The indicators the user built in the chart chat and kept. Each write answers with the row as the
 * server now holds it, so a caller can put it back in its cache without a refetch; each method takes
 * the shape web's hook passes, so it can stand as a mutation's `mutationFn` unwrapped.
 */
export const customIndicatorsApi = (http: HttpClient) => ({
  /** Newest first, the order the picker's Custom tab lists them. */
  getCustomIndicators: async (): Promise<CustomIndicator[]> =>
    (await http.request<CustomIndicatorsWire | null>('/custom-indicators'))
      ?.indicators ?? [],

  /** Saving a draft whose `draft_id` is already saved replaces that row rather than adding one. */
  saveCustomIndicator: (body: SaveCustomIndicatorRequest) =>
    http.request<CustomIndicator>('/custom-indicators', {method: 'POST', body}),

  renameCustomIndicator: ({id, name}: RenameCustomIndicatorRequest) =>
    http.request<CustomIndicator>(rowPath(id), {
      method: 'PATCH',
      body: {name},
    }),

  deleteCustomIndicator: (id: string) =>
    http.request<unknown>(rowPath(id), {method: 'DELETE'}),
});

export type CustomIndicatorsApi = ReturnType<typeof customIndicatorsApi>;
