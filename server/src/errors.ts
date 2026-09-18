import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import type { ApiError } from "@tsili/shared";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = { error: { code: "NOT_FOUND", message: `no route for ${req.method} ${req.path}` } };
  res.status(404).json(body);
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  // Express only treats a function with four parameters as an error handler, so `next` must stay.
  return (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const body: ApiError = {
        error: {
          code: "VALIDATION",
          message: "request failed validation",
          issues: err.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
        },
      };
      res.status(400).json(body);
      return;
    }
    if (err instanceof HttpError) {
      const body: ApiError = { error: { code: err.code, message: err.message } };
      res.status(err.status).json(body);
      return;
    }
    if (isBodyParseError(err)) {
      const body: ApiError = { error: { code: "BAD_JSON", message: "request body is not valid JSON" } };
      res.status(400).json(body);
      return;
    }
    logger.error({ err }, "unhandled error");
    const body: ApiError = { error: { code: "INTERNAL", message: "internal server error" } };
    res.status(500).json(body);
  };
}

function isBodyParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed";
}
