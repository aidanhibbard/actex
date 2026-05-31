import type { ActexError } from '../types/actex-error'

export const toActexError = (error: unknown): ActexError => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return {
      code: error.code,
      message: error.message,
      cause: 'cause' in error ? error.cause : undefined,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'STEP_ERROR',
      message: error.message,
      cause: error,
    }
  }

  return {
    code: 'STEP_ERROR',
    message: 'Unknown step error',
    cause: error,
  }
}
