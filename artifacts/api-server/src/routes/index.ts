import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import candidatesRouter from "./candidates";
import introRequestsRouter from "./intro-requests";
import adminRouter from "./admin";
import prospectiveRouter from "./prospective";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(candidatesRouter);
router.use(introRequestsRouter);
router.use(prospectiveRouter);
router.use(adminRouter);

export default router;
