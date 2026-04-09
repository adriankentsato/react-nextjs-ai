import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApiResponse,
  SuccessResponse,
  ErrorResponse,
  ErrorMessage,
  ApiResponseOptions,
} from '../api-response';

describe('ApiResponse', () => {
  beforeEach(() => {
    // Clear any state if needed
  });

  describe('constructor', () => {
    it('should create instance with all required properties', () => {
      const options: ApiResponseOptions = {
        statusCode: 400,
        message: 'Bad Request',
        customCode: 'BAD_REQUEST',
      };

      const response = new ApiResponse(options);

      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Bad Request');
      expect(response.customCode).toBe('BAD_REQUEST');
      expect(response.name).toBe('ApiResponse');
    });

    it('should default errorMessages to empty array when not provided', () => {
      const options: ApiResponseOptions = {
        statusCode: 500,
        message: 'Error',
        customCode: 'ERROR',
      };

      const response = new ApiResponse(options);

      expect(response.errorMessages).toEqual([]);
    });

    it('should accept custom errorMessages array', () => {
      const errorMessages: ErrorMessage[] = [
        { message: 'Field required', code: 'REQUIRED' },
        { message: 'Invalid format', code: 'FORMAT' },
      ];
      const options: ApiResponseOptions = {
        statusCode: 422,
        message: 'Validation failed',
        customCode: 'VALIDATION_FAILED',
        errorMessages,
      };

      const response = new ApiResponse(options);

      expect(response.errorMessages).toHaveLength(2);
      expect(response.errorMessages[0]).toEqual({
        message: 'Field required',
        code: 'REQUIRED',
      });
    });

    it('should extend Error class', () => {
      const response = new ApiResponse({
        statusCode: 500,
        message: 'Server Error',
        customCode: 'SERVER_ERROR',
      });

      expect(response).toBeInstanceOf(Error);
      expect(response).toBeInstanceOf(ApiResponse);
    });

    it('should handle edge case status codes', () => {
      const minCode = new ApiResponse({
        statusCode: 100,
        message: 'Continue',
        customCode: 'CONTINUE',
      });
      const maxCode = new ApiResponse({
        statusCode: 599,
        message: 'Network Connect Timeout',
        customCode: 'TIMEOUT',
      });

      expect(minCode.statusCode).toBe(100);
      expect(maxCode.statusCode).toBe(599);
    });
  });

  describe('toJSON', () => {
    it('should return error structure with message, code, and errors', () => {
      const errorMessages: ErrorMessage[] = [
        { message: 'Invalid field', code: 'INVALID' },
      ];
      const response = new ApiResponse({
        statusCode: 400,
        message: 'Bad Request',
        customCode: 'BAD_REQUEST',
        errorMessages,
      });

      const json = response.toJSON();

      expect(json).toEqual({
        error: 'Bad Request',
        code: 'BAD_REQUEST',
        errors: errorMessages,
      });
    });

    it('should return empty errors array when no errorMessages provided', () => {
      const response = new ApiResponse({
        statusCode: 500,
        message: 'Server Error',
        customCode: 'SERVER_ERROR',
      });

      const json = response.toJSON();

      expect(json.errors).toEqual([]);
    });

    it('should return empty errors array when errorMessages is empty', () => {
      const response = new ApiResponse({
        statusCode: 400,
        message: 'Bad Request',
        customCode: 'BAD_REQUEST',
        errorMessages: [],
      });

      const json = response.toJSON();

      expect(json.errors).toEqual([]);
    });
  });
});

describe('SuccessResponse', () => {
  describe('constructor', () => {
    it('should create instance with default status code 200', () => {
      const response = new SuccessResponse('OK', 'OK');

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('OK');
      expect(response.customCode).toBe('OK');
      expect(response.name).toBe('SuccessResponse');
    });

    it('should accept custom status code', () => {
      const response = new SuccessResponse('Created', 'CREATED', 201);

      expect(response.statusCode).toBe(201);
    });

    it('should default responseBody to null when not provided', () => {
      const response = new SuccessResponse('OK', 'OK');

      expect(response.responseBody).toBeNull();
    });

    it('should accept custom responseBody', () => {
      const data = { id: 123, name: 'Test' };
      const response = new SuccessResponse('OK', 'OK', 200, data);

      expect(response.responseBody).toEqual(data);
    });

    it('should extend ApiResponse', () => {
      const response = new SuccessResponse('OK', 'OK');

      expect(response).toBeInstanceOf(ApiResponse);
      expect(response).toBeInstanceOf(SuccessResponse);
    });

    it('should accept null as explicit responseBody', () => {
      const response = new SuccessResponse(
        'No Content',
        'NO_CONTENT',
        204,
        null,
      );

      expect(response.responseBody).toBeNull();
    });

    it('should convert undefined responseBody to null via default param', () => {
      const response = new SuccessResponse(
        'Partial',
        'PARTIAL',
        206,
        undefined,
      );

      // Implementation uses default parameter, so undefined becomes null
      expect(response.responseBody).toBeNull();
    });
  });

  describe('static factory methods', () => {
    describe('ok', () => {
      it('should create 200 response with default message and code', () => {
        const response = SuccessResponse.ok();

        expect(response.statusCode).toBe(200);
        expect(response.message).toBe('OK');
        expect(response.customCode).toBe('OK');
        expect(response.responseBody).toBeNull();
      });

      it('should create 200 response with data', () => {
        const data = { users: ['alice', 'bob'] };
        const response = SuccessResponse.ok(data);

        expect(response.responseBody).toEqual(data);
      });

      it('should create 200 response with null data explicitly', () => {
        const response = SuccessResponse.ok(null);

        expect(response.responseBody).toBeNull();
      });
    });

    describe('created', () => {
      it('should create 201 response with default message and code', () => {
        const response = SuccessResponse.created();

        expect(response.statusCode).toBe(201);
        expect(response.message).toBe('Created');
        expect(response.customCode).toBe('CREATED');
      });

      it('should create 201 response with data', () => {
        const data = { id: 1, url: '/api/items/1' };
        const response = SuccessResponse.created(data);

        expect(response.responseBody).toEqual(data);
      });
    });

    describe('accepted', () => {
      it('should create 202 response with default message and code', () => {
        const response = SuccessResponse.accepted();

        expect(response.statusCode).toBe(202);
        expect(response.message).toBe('Accepted');
        expect(response.customCode).toBe('ACCEPTED');
      });

      it('should create 202 response with job data', () => {
        const data = { jobId: 'abc-123', status: 'pending' };
        const response = SuccessResponse.accepted(data);

        expect(response.responseBody).toEqual(data);
      });
    });

    describe('noContent', () => {
      it('should create 204 response with default message and code', () => {
        const response = SuccessResponse.noContent();

        expect(response.statusCode).toBe(204);
        expect(response.message).toBe('No Content');
        expect(response.customCode).toBe('NO_CONTENT');
      });

      it('should create 204 response with null responseBody', () => {
        const response = SuccessResponse.noContent();

        // noContent() omits data param, so responseBody defaults to null
        expect(response.responseBody).toBeNull();
      });
    });
  });

  describe('toJSON', () => {
    it('should return success structure with message, code, and data', () => {
      const data = { id: 1 };
      const response = SuccessResponse.ok(data);

      const json = response.toJSON();

      expect(json).toEqual({
        message: 'OK',
        code: 'OK',
        data: data,
      });
    });

    it('should return null data when no data provided', () => {
      const response = SuccessResponse.ok();

      const json = response.toJSON();

      expect(json.data).toBeNull();
    });

    it('should return complex nested data structure', () => {
      const data = {
        users: [{ id: 1 }, { id: 2 }],
        meta: { count: 2, page: 1 },
      };
      const response = SuccessResponse.ok(data);

      const json = response.toJSON();

      expect(json.data).toEqual(data);
    });
  });
});

describe('ErrorResponse', () => {
  describe('constructor', () => {
    it('should create instance with default values', () => {
      const response = new ErrorResponse();

      expect(response.statusCode).toBe(500);
      expect(response.message).toBe('Internal server error');
      expect(response.customCode).toBe('INTERNAL_ERROR');
      expect(response.errorMessages).toEqual([]);
      expect(response.name).toBe('ErrorResponse');
    });

    it('should accept custom message', () => {
      const response = new ErrorResponse('Custom error');

      expect(response.message).toBe('Custom error');
    });

    it('should accept custom code', () => {
      const response = new ErrorResponse('Error', 'CUSTOM_CODE');

      expect(response.customCode).toBe('CUSTOM_CODE');
    });

    it('should accept custom status code', () => {
      const response = new ErrorResponse('Error', 'CODE', 503);

      expect(response.statusCode).toBe(503);
    });

    it('should accept custom errorMessages', () => {
      const errors: ErrorMessage[] = [
        { message: 'Field missing', code: 'MISSING' },
      ];
      const response = new ErrorResponse('Error', 'CODE', 400, errors);

      expect(response.errorMessages).toEqual(errors);
    });

    it('should extend ApiResponse', () => {
      const response = new ErrorResponse();

      expect(response).toBeInstanceOf(ApiResponse);
      expect(response).toBeInstanceOf(ErrorResponse);
    });

    it('should inherit toJSON from ApiResponse', () => {
      const errors: ErrorMessage[] = [{ message: 'Invalid', code: 'INVALID' }];
      const response = new ErrorResponse(
        'Bad Request',
        'BAD_REQUEST',
        400,
        errors,
      );

      const json = response.toJSON();

      expect(json).toEqual({
        error: 'Bad Request',
        code: 'BAD_REQUEST',
        errors: errors,
      });
    });
  });

  describe('static factory methods', () => {
    describe('badRequest', () => {
      it('should create 400 response with defaults', () => {
        const response = ErrorResponse.badRequest();

        expect(response.statusCode).toBe(400);
        expect(response.message).toBe('Bad Request');
        expect(response.customCode).toBe('BAD_REQUEST');
        expect(response.errorMessages).toEqual([]);
      });

      it('should create 400 response with custom message', () => {
        const response = ErrorResponse.badRequest('Invalid input');

        expect(response.message).toBe('Invalid input');
      });

      it('should create 400 response with error messages', () => {
        const errors: ErrorMessage[] = [
          { message: 'Email required', code: 'EMAIL_REQUIRED' },
          { message: 'Invalid format', code: 'EMAIL_FORMAT' },
        ];
        const response = ErrorResponse.badRequest('Validation failed', errors);

        expect(response.errorMessages).toHaveLength(2);
        expect(response.errorMessages[0].code).toBe('EMAIL_REQUIRED');
      });
    });

    describe('unauthorized', () => {
      it('should create 401 response with defaults', () => {
        const response = ErrorResponse.unauthorized();

        expect(response.statusCode).toBe(401);
        expect(response.message).toBe('Unauthorized');
        expect(response.customCode).toBe('UNAUTHORIZED');
      });

      it('should create 401 response with custom message', () => {
        const response = ErrorResponse.unauthorized('Token expired');

        expect(response.message).toBe('Token expired');
      });

      it('should create 401 response with error details', () => {
        const errors: ErrorMessage[] = [
          { message: 'Token expired at 2024-01-01', code: 'TOKEN_EXPIRED' },
        ];
        const response = ErrorResponse.unauthorized('Session expired', errors);

        expect(response.errorMessages).toEqual(errors);
      });
    });

    describe('forbidden', () => {
      it('should create 403 response with defaults', () => {
        const response = ErrorResponse.forbidden();

        expect(response.statusCode).toBe(403);
        expect(response.message).toBe('Forbidden');
        expect(response.customCode).toBe('FORBIDDEN');
      });

      it('should create 403 response with custom message', () => {
        const response = ErrorResponse.forbidden('Access denied');

        expect(response.message).toBe('Access denied');
      });

      it('should create 403 response with permission details', () => {
        const errors: ErrorMessage[] = [
          { message: 'Admin role required', code: 'INSUFFICIENT_ROLE' },
        ];
        const response = ErrorResponse.forbidden('Permission denied', errors);

        expect(response.errorMessages[0].code).toBe('INSUFFICIENT_ROLE');
      });
    });

    describe('notFound', () => {
      it('should create 404 response with defaults', () => {
        const response = ErrorResponse.notFound();

        expect(response.statusCode).toBe(404);
        expect(response.message).toBe('Not Found');
        expect(response.customCode).toBe('NOT_FOUND');
      });

      it('should create 404 response with resource type', () => {
        const response = ErrorResponse.notFound('User not found');

        expect(response.message).toBe('User not found');
      });

      it('should create 404 response with search criteria', () => {
        const errors: ErrorMessage[] = [
          { message: 'ID: 123', code: 'RESOURCE_NOT_FOUND' },
        ];
        const response = ErrorResponse.notFound('User not found', errors);

        expect(response.errorMessages[0].message).toBe('ID: 123');
      });
    });

    describe('conflict', () => {
      it('should create 409 response with defaults', () => {
        const response = ErrorResponse.conflict();

        expect(response.statusCode).toBe(409);
        expect(response.message).toBe('Conflict');
        expect(response.customCode).toBe('CONFLICT');
      });

      it('should create 409 response with duplicate info', () => {
        const response = ErrorResponse.conflict('Email already exists');

        expect(response.message).toBe('Email already exists');
      });

      it('should create 409 response with conflict details', () => {
        const errors: ErrorMessage[] = [
          { message: 'Duplicate key: email', code: 'DUPLICATE_ENTRY' },
        ];
        const response = ErrorResponse.conflict('Resource exists', errors);

        expect(response.errorMessages[0].code).toBe('DUPLICATE_ENTRY');
      });
    });

    describe('internalServerError', () => {
      it('should create 500 response with defaults', () => {
        const response = ErrorResponse.internalServerError();

        expect(response.statusCode).toBe(500);
        expect(response.message).toBe('Internal Server Error');
        expect(response.customCode).toBe('INTERNAL_SERVER_ERROR');
      });

      it('should create 500 response with custom message', () => {
        const response = ErrorResponse.internalServerError('Database timeout');

        expect(response.message).toBe('Database timeout');
      });

      it('should create 500 response with error trace info', () => {
        const errors: ErrorMessage[] = [
          { message: 'Connection failed', code: 'DB_CONNECTION' },
          { message: 'Query timeout', code: 'QUERY_TIMEOUT' },
        ];
        const response = ErrorResponse.internalServerError(
          'Database error',
          errors,
        );

        expect(response.errorMessages).toHaveLength(2);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty string message', () => {
      const response = new ErrorResponse('');

      expect(response.message).toBe('');
    });

    it('should handle empty string customCode', () => {
      const response = new ErrorResponse('Error', '');

      expect(response.customCode).toBe('');
    });

    it('should handle zero status code', () => {
      const response = new ErrorResponse('Error', 'CODE', 0);

      expect(response.statusCode).toBe(0);
    });

    it('should handle very large errorMessages array', () => {
      const errors: ErrorMessage[] = Array.from({ length: 100 }, (_, i) => ({
        message: `Error ${i}`,
        code: `ERR_${i}`,
      }));
      const response = ErrorResponse.badRequest('Many errors', errors);

      expect(response.errorMessages).toHaveLength(100);
    });

    it('should preserve errorMessages reference or create copy', () => {
      const errors: ErrorMessage[] = [{ message: 'Test', code: 'TEST' }];
      const response = ErrorResponse.badRequest('Error', errors);

      // Modifying original should not affect response if defensive copy made
      // Or if reference shared, modification affects both
      errors.push({ message: 'Added', code: 'ADDED' });

      // Document actual behavior - reference is shared per current implementation
      expect(response.errorMessages).toHaveLength(2);
    });
  });
});

describe('Type exports', () => {
  it('should export ErrorMessage interface', () => {
    const error: ErrorMessage = { message: 'Test', code: 'TEST' };

    expect(error.message).toBe('Test');
    expect(error.code).toBe('TEST');
  });

  it('should export ApiResponseOptions interface', () => {
    const options: ApiResponseOptions = {
      statusCode: 200,
      message: 'OK',
      customCode: 'OK',
      errorMessages: [],
    };

    expect(options.statusCode).toBe(200);
  });
});
