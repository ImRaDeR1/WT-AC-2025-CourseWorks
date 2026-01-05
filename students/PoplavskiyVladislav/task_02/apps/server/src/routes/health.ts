import { Router } from "express";
import { ok } from "../lib/http";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json(ok({ message: "healthy" }));
});
