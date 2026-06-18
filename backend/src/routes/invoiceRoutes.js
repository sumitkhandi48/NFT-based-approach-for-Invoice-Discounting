import { Router } from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
    uploadInvoice,
    mintInvoice,
    signInvoice,
    getInvoice,
} from "../controllers/invoiceController.js";

const router = Router();

router.post("/upload", upload.single("invoice"), uploadInvoice);
router.post("/mint", mintInvoice);
router.post("/sign", signInvoice);
router.get("/:tokenId", getInvoice);

export default router;