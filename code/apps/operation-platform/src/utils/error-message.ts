import { isAxiosError } from 'axios';

/** Use an API message only after checking the caught value and response shape. */
export function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<unknown>(error)) {
    const data = error.response?.data;
    if (
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message
    )
      return data.message;
  }
  return fallback;
}
