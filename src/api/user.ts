import type {
  UserProfileResponse,
  acceptTermsRequest,
  setServiceRequest,
  updatePasswordRequest,
  updatePreferencesRequest,
} from '../types/user.ts';
import type {HttpClient} from './http.ts';

export type PushPlatform = 'ios' | 'android';

export const userApi = (http: HttpClient) => ({
  getUserProfile: () => http.request<UserProfileResponse>('/user-profile'),

  updatePassword: (data: updatePasswordRequest) =>
    http.request<{success: boolean}>('/update-password', {
      method: 'POST',
      body: data,
    }),

  setService: (data: setServiceRequest) =>
    http.request<{success: boolean}>('/set-service', {
      method: 'POST',
      body: data,
    }),

  updatePreferences: (preferences: updatePreferencesRequest) =>
    http.request<{success: boolean}>('/update-preferences', {
      method: 'POST',
      body: preferences,
    }),

  /** Web-only until now: records the terms acceptance the signup wall asks for. */
  acceptTerms: (data: acceptTermsRequest) =>
    http.request<{success: boolean}>('/accept-terms', {
      method: 'POST',
      body: data,
    }),

  /**
   * Mobile-only: `platform` routes the token ("android" to FCM, "ios" to APNs).
   * Omitted on logout, where a null token clears every device.
   */
  updatePushToken: (pushToken: string | null, platform?: PushPlatform) =>
    http.request<{message: string}>('/push-token', {
      method: 'PUT',
      body: {
        push_token: pushToken,
        ...(platform === undefined ? {} : {platform}),
      },
    }),

  /** Sends the deletion-confirmation email (link → /confirm-delete?token=…). */
  requestDeleteAccount: () =>
    http.request<{message: string}>('/user/delete-account', {
      method: 'DELETE',
    }),

  /** Finalizes deletion once the emailed token is presented. */
  confirmDeleteAccount: (token: string) =>
    http.request<{message: string}>('/user/confirm-delete-account', {
      method: 'DELETE',
      body: {token},
    }),
});

export type UserApi = ReturnType<typeof userApi>;
