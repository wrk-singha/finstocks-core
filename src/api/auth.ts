import type {
  AuthTokenResponse,
  CheckEmailResult,
  LoginResponse,
  MessageResponse,
  SignupRequest,
  SignupResponse,
  VerifyOtpResponse,
  WaitlistResponse,
} from '../types/auth.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

const anonymous = {anonymous: true} as const;

export const authApi = (http: HttpClient) => ({
  /** Classifies an email before a password is ever asked for, so login can branch into the invite gate. */
  checkEmail: (email: string) =>
    http.request<CheckEmailResult>('/auth/check-email', {
      method: 'POST',
      body: {email},
      ...anonymous,
    }),

  joinWaitlist: (email: string) =>
    http.request<WaitlistResponse>('/auth/waitlist', {
      method: 'POST',
      body: {email},
      ...anonymous,
    }),

  login: (email: string, password: string) =>
    http.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: {email, password},
      ...anonymous,
    }),

  // drift resolved 2026-09-13: the mobile sent referral_code, the web marketing_opt_in;
  // both are optional on the backend so the payload is the union. Neither copy lost.
  signup: (payload: SignupRequest) =>
    http.request<SignupResponse>('/auth/signup', {
      method: 'POST',
      body: {
        username: payload.username,
        email: payload.email,
        password: payload.password,
        ...(payload.referral_code === undefined
          ? {}
          : {referral_code: payload.referral_code}),
        ...(payload.marketing_opt_in === undefined
          ? {}
          : {marketing_opt_in: payload.marketing_opt_in}),
      },
      ...anonymous,
    }),

  // drift resolved 2026-09-13: the web passed marketing_opt_in, the mobile did not;
  // the web copy won because signup-by-Google is the only path that can record consent.
  googleLogin: (idToken: string, marketingOptIn?: boolean) =>
    http.request<AuthTokenResponse>('/auth/google-login', {
      method: 'POST',
      body: {
        token: idToken,
        ...(marketingOptIn === undefined
          ? {}
          : {marketing_opt_in: marketingOptIn}),
      },
      ...anonymous,
    }),

  sendOtp: (key: string) =>
    http.request<MessageResponse>('/auth/send-otp', {
      method: 'POST',
      body: {key},
      ...anonymous,
    }),

  // drift resolved 2026-09-13: the mobile sent referral_code and typed `user` on the
  // response, the web did neither; the mobile copy won (the referral is applied at
  // verification, and `VerifyOtpResponse` is a superset of what the web reads).
  verifyOtp: (key: string, otp: string, referralCode?: string) =>
    http.request<VerifyOtpResponse>('/auth/verify-login-otp', {
      method: 'POST',
      body: {
        key,
        otp,
        ...(referralCode === undefined ? {} : {referral_code: referralCode}),
      },
      ...anonymous,
    }),

  forgotPassword: (email: string) =>
    http.request<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: {email},
      ...anonymous,
    }),

  resetPassword: (token: string, newPassword: string) =>
    http.request<MessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: {token, new_password: newPassword},
      ...anonymous,
    }),

  verifyResetToken: (token: string) =>
    http.request<MessageResponse>(`/auth/verify-token${query({token})}`, {
      ...anonymous,
    }),

  logout: () => http.request<MessageResponse>('/logout', {method: 'POST'}),
});

export type AuthApi = ReturnType<typeof authApi>;
