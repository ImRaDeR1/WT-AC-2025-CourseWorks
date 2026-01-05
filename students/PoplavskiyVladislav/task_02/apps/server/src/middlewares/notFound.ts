import type { Request, Response } from "express";
import { err } from "../lib/http";

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json(err("not_found", "Not found"));
};
