export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown | undefined;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (code: string, message: string, details?: unknown) => new AppError(400, code, message, details),
  unauthorized: (code = "UNAUTHORIZED", message = "Authentication is required.") => new AppError(401, code, message),
  forbidden: (code: string, message: string) => new AppError(403, code, message),
  conflict: (code: string, message: string) => new AppError(409, code, message),
};
