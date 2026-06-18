import { Router } from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
    uploadInvoice,
    mintInvoice,
    signInvoice,
    listInvoice,
    revokeInvoice,
    buyInvoice,
    settleInvoice,
    getInvoice,
} from "../controllers/invoiceController.js";

const router = Router();

router.post("/upload", upload.single("invoice"), uploadInvoice);
router.post("/mint", mintInvoice);
router.post("/sign", signInvoice);
router.post("/list", listInvoice);
router.post("/revoke", revokeInvoice);
router.post("/buy", buyInvoice);
router.post("/settle", settleInvoice);
router.get("/:tokenId", getInvoice);

export default router;