import { Router } from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
    uploadInvoice,
    getInvoice,
} from "../controllers/invoiceController.js";

const router = Router();

router.post("/upload", upload.single("invoice"), uploadInvoice);
router.get("/:tokenId", getInvoice);

export default router;