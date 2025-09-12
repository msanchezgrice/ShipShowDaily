export function isUnauthorizedError(error: Error | unknown): boolean {
  if (!error) return false;
  const message = (error as Error).message ?? String(error);
  return message.includes("401") || /unauthorized/i.test(message);
}

export function redirectToSignInClient(): void {
  window.location.href = "/";
}