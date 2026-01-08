import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { openApiSpec } from "./openapi";
import { apiRouter } from "./routes";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json());

  app.get("/openapi.json", (_req, res) => res.status(200).json(openApiSpec));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
