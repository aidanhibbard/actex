export class ActexError extends Error {
  public readonly code: string

  public constructor(message: string, code = 'ACTEX_ERROR') {
    super(message)
    this.name = 'ActexError'
    this.code = code
  }
}
