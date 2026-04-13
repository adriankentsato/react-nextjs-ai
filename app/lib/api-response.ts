export interface ErrorMessage {
  message: string;
  code: string;
}

export interface ApiResponseOptions {
  statusCode: number;
  message: string;
  customCode: string;
  errorMessages?: ErrorMessage[];
}

export class ApiResponse extends Error {
  statusCode: number;
  customCode: string;
  errorMessages: ErrorMessage[];

  constructor({
    statusCode,
    message,
    customCode,
    errorMessages = [],
  }: ApiResponseOptions) {
    super(message);
    this.statusCode = statusCode;
    this.customCode = customCode;
    this.errorMessages = errorMessages;
    this.name = 'ApiResponse';
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.customCode,
      errors: this.errorMessages,
    };
  }
}

export class SuccessResponse extends ApiResponse {
  responseBody: unknown;

  constructor(
    message: string,
    customCode: string,
    statusCode: number = 200,
    responseBody: unknown = null,
  ) {
    super({ statusCode, message, customCode });
    this.responseBody = responseBody;
    this.name = 'SuccessResponse';
  }

  static ok(data: unknown = null) {
    return new SuccessResponse('OK', 'OK', 200, data);
  }

  static created(data: unknown = null) {
    return new SuccessResponse('Created', 'CREATED', 201, data);
  }

  static accepted(data: unknown = null) {
    return new SuccessResponse('Accepted', 'ACCEPTED', 202, data);
  }

  static noContent() {
    return new SuccessResponse('No Content', 'NO_CONTENT', 204);
  }

  toJSON(): Record<string, unknown> {
    return {
      message: this.message,
      code: this.customCode,
      data: this.responseBody,
    };
  }
}

export class ErrorResponse extends ApiResponse {
  constructor(
    message: string = 'Internal server error',
    customCode: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    errorMessages: ErrorMessage[] = [],
  ) {
    super({ statusCode, message, customCode, errorMessages });
    this.name = 'ErrorResponse';
  }

  static badRequest(
    message: string = 'Bad Request',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(message, 'BAD_REQUEST', 400, errorMessages);
  }

  static unauthorized(
    message: string = 'Unauthorized',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(message, 'UNAUTHORIZED', 401, errorMessages);
  }

  static forbidden(
    message: string = 'Forbidden',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(message, 'FORBIDDEN', 403, errorMessages);
  }

  static notFound(
    message: string = 'Not Found',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(message, 'NOT_FOUND', 404, errorMessages);
  }

  static conflict(
    message: string = 'Conflict',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(message, 'CONFLICT', 409, errorMessages);
  }

  static internalServerError(
    message: string = 'Internal Server Error',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(
      message,
      'INTERNAL_SERVER_ERROR',
      500,
      errorMessages,
    );
  }

  static tooManyRequests(
    message: string = 'Too Many Requests',
    errorMessages: ErrorMessage[] = [],
  ) {
    return new ErrorResponse(message, 'TOO_MANY_REQUESTS', 429, errorMessages);
  }
}
