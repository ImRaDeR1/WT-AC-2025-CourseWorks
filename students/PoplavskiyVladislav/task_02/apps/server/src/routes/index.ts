import { Router } from "express";
import { authRouter } from "./auth";
import { groupsRouter } from "./groups";
import { healthRouter } from "./health";
import { materialsRouter } from "./materials";
import { meetingsRouter } from "./meetings";
import { tasksRouter } from "./tasks";
import { topicsRouter } from "./topics";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(groupsRouter);
apiRouter.use(topicsRouter);
apiRouter.use(meetingsRouter);
apiRouter.use(materialsRouter);
apiRouter.use(tasksRouter);
