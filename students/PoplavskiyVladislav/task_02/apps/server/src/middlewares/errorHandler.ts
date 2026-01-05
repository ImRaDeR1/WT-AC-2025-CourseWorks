import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError, err } from "../lib/http";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // JSON parse error from body-parser
  if (
    typeof error === "object" &&
    error &&
    (error as { statusCode?: unknown }).statusCode === 400 &&
    (error as { type?: unknown }).type === "entity.parse.failed"
  ) {
    res.status(400).json(err("bad_request", "Invalid JSON"));
    return;
  }

  if (error instanceof ZodError) {
    const flat = error.flatten();
    const fields: Record<string, string> = {};

    const fieldErrors = flat.fieldErrors as Record<string, string[] | undefined>;

    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages && messages.length > 0) {
        fields[key] = messages[0] ?? "Invalid value";
      }
    }

    res.status(400).json(err("bad_request", "Validation error", fields));
    return;
  }

  if (error instanceof HttpError) {
    res
      .status(error.statusCode)
      .json(err(error.code, error.message, error.fields));
    return;
  }

  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json(err("internal_error", "Internal server error"));
};
