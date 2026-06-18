import { uploadToIPFS } from "../services/ipfsService.js";
import { getInvoiceMetadata } from "../services/blockchainService.js";
import { unlink } from "fs/promises";

// POST /api/invoices/upload
export async function uploadInvoice(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { cid, url } = await uploadToIPFS(req.file.path, req.file.originalname);
        await unlink(req.file.path);

        return res.status(200).json({
            success: true,
            cid,
            url,
            message: "Invoice uploaded to IPFS successfully",
        });
    } catch (error) {
        console.error("IPFS upload error:", error.message);
        return res.status(500).json({ error: "Failed to upload to IPFS" });
    }
}

// GET /api/invoices/:tokenId
export async function getInvoice(req, res) {
    try {
        const { tokenId } = req.params;
        const invoice = await getInvoiceMetadata(tokenId);

        return res.status(200).json({
            success: true,
            invoice,
        });
    } catch (error) {
        console.error("Get invoice error:", error.message);
        return res.status(404).json({ error: "Invoice not found" });
    }
}