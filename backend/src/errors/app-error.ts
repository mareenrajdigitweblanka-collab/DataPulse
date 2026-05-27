/**
 * Standard application error.
 * All expected API errors should use this class.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(params: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(params.message);

    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}