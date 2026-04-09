import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse, SuccessResponse, ErrorResponse } from './api-response';

export { ApiResponse, SuccessResponse, ErrorResponse };

export interface ApiRequest extends NextRequest {
  processId: string;
}

export type ApiFunction = (request: ApiRequest) => unknown | Promise<unknown>;
export type FunctionErrorHandler = (
  error: unknown,
  request: ApiRequest,
) => NextResponse | void;

export interface ApiHandlerOptions {
  functions: ApiFunction[];
  onFunctionError?: FunctionErrorHandler;
}

function generateProcessId(): string {
  return randomUUID();
}

function defaultErrorHandler(
  error: unknown,
  request: ApiRequest,
): NextResponse {
  if (error instanceof SuccessResponse) {
    // Handle success response
    return compressResponse(
      NextResponse.json(error.toJSON(), { status: error.statusCode }),
      request,
    );
  }

  if (error instanceof ApiResponse) {
    return compressResponse(
      NextResponse.json(error.toJSON(), { status: error.statusCode }),
      request,
    );
  }

  return compressResponse(
    NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    request,
  );
}

function compressResponse(
  response: NextResponse,
  request: ApiRequest,
): NextResponse {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const shouldCompress = acceptEncoding.includes('gzip');

  if (shouldCompress) {
    response.headers.set('content-encoding', 'gzip');
  }

  return response;
}

export function apiHandler(
  functionsOrOptions: ApiFunction[] | ApiHandlerOptions,
  errorHandler?: FunctionErrorHandler,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const apiRequest = request as ApiRequest;
    apiRequest.processId = generateProcessId();

    let fns: ApiFunction[];
    let fnErrorHandler: FunctionErrorHandler | undefined;

    if (Array.isArray(functionsOrOptions)) {
      fns = functionsOrOptions;
      fnErrorHandler = errorHandler;
    } else {
      fns = functionsOrOptions.functions;
      fnErrorHandler = functionsOrOptions.onFunctionError;
    }

    try {
      let hasReturnValue = false;

      for (const fn of fns) {
        try {
          const result = fn(apiRequest);

          let resolvedResult: unknown;
          if (result instanceof Promise) {
            resolvedResult = await result;
          } else {
            resolvedResult = result;
          }

          if (resolvedResult !== undefined && resolvedResult !== null) {
            hasReturnValue = true;
          }

          if (resolvedResult instanceof ApiResponse) {
            throw resolvedResult;
          }
        } catch (fnError) {
          if (fnErrorHandler) {
            const response = fnErrorHandler(fnError, apiRequest);
            if (response) {
              return compressResponse(response, apiRequest);
            }
          }

          return defaultErrorHandler(fnError, apiRequest);
        }
      }

      if (!hasReturnValue) {
        throw new ErrorResponse('Not found', 'NOT_FOUND', 404);
      }

      return compressResponse(
        NextResponse.json({ success: true, processId: apiRequest.processId }),
        apiRequest,
      );
    } catch (error) {
      return defaultErrorHandler(error, apiRequest);
    }
  };
}
