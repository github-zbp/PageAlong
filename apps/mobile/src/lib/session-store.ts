let sessionToken: string | null = null;

export function getSessionToken(): string | null {
  return sessionToken;
}

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function clearSessionToken(): void {
  sessionToken = null;
}
