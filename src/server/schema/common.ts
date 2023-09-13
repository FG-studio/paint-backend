import { z } from 'zod'

export enum ErrorCode {
  UNKNOW_ERROR = 'UNKNOW_ERROR',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  PERMISSION_DENNIED = 'PERMISSION_DENNIED',
  INTERNAL_SYS_ERROR = 'INTERNAL_SYS_ERROR',
}

export enum ErrorCode2StatusCode {
  UNKNOW_ERROR = 500,
  ENTITY_NOT_FOUND = 404,
  VALIDATION_ERROR = 400,
  UNAUTHORIZED = 401,
  PERMISSION_DENNIED = 403,
  INTERNAL_SYS_ERROR = 502,
}

export class SystemError {
  constructor(
    public code: string,
    public msg?: string,
  ) {}
}

export const ErrorSchema = z.object({
  code: z.string(),
  msg: z.string().optional(),
})

export const statusResponse = z.object({
  status: z.boolean().default(true),
})

export const ErrorSchemaWithCode = {
  400: ErrorSchema,
  401: ErrorSchema,
  403: ErrorSchema,
  404: ErrorSchema,
  429: ErrorSchema,
  500: ErrorSchema,
  501: ErrorSchema,
  502: ErrorSchema,
}
