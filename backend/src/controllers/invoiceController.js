import { uploadToIPFS } from "../services/ipfsService.js";
import { unlink } from "fs/promises";

// POST /api/invoices/upload
export async function uploadInvoice(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { cid, url } = await uploadToIPFS(req.file.path, req.file.originalname);

        // Delete local temp file after upload
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