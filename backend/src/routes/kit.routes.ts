import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createKit, listKits, getKit, updateKit, regenerateSection } from "../controllers/kit.controller";

const router = Router();
router.use(requireAuth);
router.get("/", listKits);
router.post("/", createKit);
router.get("/:id", getKit);
router.patch("/:id", updateKit);
router.post("/:id/regenerate", regenerateSection);

export default router;
