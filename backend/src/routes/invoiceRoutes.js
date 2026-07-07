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
    getBlockchainInvoices,
    getInvoice,
} from "../controllers/invoiceController.js";
import { getMarketplaceInvoices } from "../controllers/dashboardController.js";

const router = Router();

router.post("/upload", upload.single("invoice"), uploadInvoice);
router.post("/mint", mintInvoice);
router.post("/sign", signInvoice);
router.post("/list", listInvoice);
router.post("/revoke", revokeInvoice);
router.post("/buy", buyInvoice);
router.post("/settle", settleInvoice);
router.get("/summary", getBlockchainInvoices);
router.get("/marketplace", getMarketplaceInvoices);
router.get("/:tokenId", getInvoice);

export default router;