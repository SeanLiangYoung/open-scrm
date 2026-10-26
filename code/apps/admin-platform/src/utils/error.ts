/** Read the API's user-facing message after narrowing an unknown rejection. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return fallback;
  const data = response.data;
  if (typeof data !== 'object' || data === null || !('message' in data)) return fallback;
  return typeof data.message === 'string' && data.message ? data.message : fallback;
}
