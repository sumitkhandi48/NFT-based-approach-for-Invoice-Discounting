import { Router } from "express";
import upload from "../middleware/uploadMiddleware.js";
import { uploadInvoice } from "../controllers/invoiceController.js";

const router = Router();

// IPFS upload
router.post("/upload", upload.single("invoice"), uploadInvoice);

export default router;