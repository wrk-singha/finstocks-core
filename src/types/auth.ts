import type {UserProfileResponse} from './user.ts';

/**
 * The auth endpoints' request and response bodies. Mobile carried these inline in
 * `services/auth.ts`; web declared them in `interfaces/components.ts`. Names follow web where
 * it had one, with the mobile spelling kept as an alias.
 */

export interface CheckEmailRequest {
  email: string;
}

/** Classifies an email before a password is asked for, so login can branch into the invite gate. */
export interface CheckEmailResult {
  exists: boolean;
  waitlisted: boolean;
  approved: boolean;
}

export type CheckEmailResponse = CheckEmailResult;

export interface WaitlistRequest {
  email: string;
}

export interface WaitlistResponse {
  message: string;
  status: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  /** The OTP challenge key; the session token comes from verifyOTP. */
  key?: string;
  /** DEV-only (MODE=DEV): backend skips OTP and returns a session token directly. */
  token?: string;
  message?: string;
  is_new_user?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  referral_code?: string;
  marketing_opt_in?: boolean;
}

export type SignupRequest = RegisterRequest;

export interface SignupResponse {
  key: string;
  // drift resolved 2026-09-13: mobile typed `message` required, web optional. Optional wins:
  // web is the copy that declared the field's siblings (`is_new_user`) off the handler.
  message?: string;
  is_new_user?: boolean;
}

export interface GoogleLoginRequest {
  /** The Google ID token. */
  token: string;
}

/**
 * Every endpoint that mints a session JWT returns this shape. Google signup and Google login
 * share one endpoint, so `is_new_user` is the only way to tell them apart on the client.
 */
export interface AuthTokenResponse {
  token: string;
  message?: string;
  is_new_user?: boolean;
}

export interface SendOtpRequest {
  key: string;
}

export interface VerifyOtpRequest {
  key: string;
  otp: string;
  referral_code?: string;
}

export interface VerifyOtpResponse {
  token: string;
  user: UserProfileResponse;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

/** What sendOTP, forgotPassword, resetPassword, verifyResetToken and logout all answer with. */
export interface MessageResponse {
  message: string;
}
