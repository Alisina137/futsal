import type { PasswordResetVerifyResponse } from "@leaguekick/contracts";

let session: PasswordResetVerifyResponse | null = null;

export function setPasswordResetSession(value: PasswordResetVerifyResponse) {
  session = value;
}

export function getPasswordResetSession() {
  return session;
}

export function clearPasswordResetSession() {
  session = null;
}
