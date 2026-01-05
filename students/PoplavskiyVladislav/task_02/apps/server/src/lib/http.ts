export type ApiOk<T> = { status: "ok"; data: T };
export type ApiError = {
  status: "error";
  error: { code: string; message: string; fields?: Record<string, string> };
};

export const ok = <T>(data: T): ApiOk<T> => ({ status: "ok", data });

export const err = (
  code: string,
  message: string,
  fields?: Record<string, string>
): ApiError => ({ status: "error", error: { code, message, fields } });

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    fields?: Record<string, string>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}
