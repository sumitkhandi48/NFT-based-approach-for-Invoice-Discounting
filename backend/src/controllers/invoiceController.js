import { uploadToIPFS } from "../services/ipfsService.js";
import { ethers } from "ethers";
import {
    getBlockchainSummary,
    getInvoiceMetadata,
    validateDueDate,
} from "../services/blockchainService.js";
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

// POST /api/invoices/mint
export async function mintInvoice(req, res) {
    try {
        const { cid, buyerAddress, invoiceAmount, dueDate } = req.body;

        if (!cid || !buyerAddress || !invoiceAmount || !dueDate) {
            return res.status(400).json({
                error: "Missing required fields: cid, buyerAddress, invoiceAmount, dueDate",
            });
        }

        const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
        if (!dateRegex.test(dueDate)) {
            return res.status(400).json({
                error: "Invalid due date format. Use DD-MM-YYYY",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Inputs validated. Call mintInvoice() via MetaMask.",
            params: { cid, buyerAddress, invoiceAmount, dueDate },
        });
    } catch (error) {
        console.error("Mint validation error:", error.message);
        return res.status(500).json({ error: "Mint validation failed" });
    }
}

// POST /api/invoices/sign
export async function signInvoice(req, res) {
    try {
        const { tokenId } = req.body;

        if (tokenId === undefined || tokenId === null) {
            return res.status(400).json({ error: "Missing required field: tokenId" });
        }

        const invoice = await getInvoiceMetadata(tokenId);

        if (invoice.isApproved) {
            return res.status(400).json({ error: "Invoice is already signed" });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice ready to sign. Call signInvoice() via MetaMask.",
            invoice,
        });
    } catch (error) {
        console.error("Sign validation error:", error.message);
        return res.status(500).json({ error: "Sign validation failed" });
    }
}

// POST /api/invoices/list
export async function listInvoice(req, res) {
    try {
        const { tokenId, price } = req.body;

        if (tokenId === undefined || !price) {
            return res.status(400).json({
                error: "Missing required fields: tokenId, price",
            });
        }

        const invoice = await getInvoiceMetadata(tokenId);

        if (!invoice.isApproved) {
            return res.status(400).json({
                error: "Invoice must be signed by buyer before listing",
            });
        }

        if (invoice.forSale) {
            return res.status(400).json({ error: "Invoice is already listed for sale" });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice ready to list. Call approveInvoiceSale() via MetaMask.",
            invoice,
        });
    } catch (error) {
        console.error("List validation error:", error.message);
        return res.status(500).json({ error: "List validation failed" });
    }
}

// POST /api/invoices/revoke
export async function revokeInvoice(req, res) {
    try {
        const { tokenId } = req.body;

        if (tokenId === undefined) {
            return res.status(400).json({ error: "Missing required field: tokenId" });
        }

        const invoice = await getInvoiceMetadata(tokenId);

        if (!invoice.forSale) {
            return res.status(400).json({ error: "Invoice is not listed for sale" });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice ready to delist. Call revokeInvoiceSale() via MetaMask.",
            invoice,
        });
    } catch (error) {
        console.error("Revoke validation error:", error.message);
        return res.status(500).json({ error: "Revoke validation failed" });
    }
}

// POST /api/invoices/buy
export async function buyInvoice(req, res) {
    try {
        const { tokenId } = req.body;

        if (tokenId === undefined) {
            return res.status(400).json({ error: "Missing required field: tokenId" });
        }

        const invoice = await getInvoiceMetadata(tokenId);

        if (!invoice.forSale) {
            return res.status(400).json({ error: "Invoice is not listed for sale" });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice ready to buy. Call buyInvoice() via MetaMask.",
            invoice,
            priceWei: ethers.parseEther(invoice.currPrice).toString(),
        });
    } catch (error) {
        console.error("Buy validation error:", error.message);
        return res.status(500).json({ error: "Buy validation failed" });
    }
}

// POST /api/invoices/settle
export async function settleInvoice(req, res) {
    try {
        const { tokenId } = req.body;

        if (tokenId === undefined) {
            return res.status(400).json({ error: "Missing required field: tokenId" });
        }

        const invoice = await getInvoiceMetadata(tokenId);

        if (!invoice.isApproved) {
            return res.status(400).json({
                error: "Invoice has not been approved by buyer",
            });
        }

        // Algorithm 9 — due date gate enforced here (Node.js layer)
        const isDue = validateDueDate(invoice.dueDate);
        if (!isDue) {
            return res.status(400).json({
                error: `Invoice is not yet due. Due date: ${invoice.dueDate}`,
                dueDate: invoice.dueDate,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Due date validated. Call settleInvoice() via MetaMask.",
            invoice,
            priceWei: ethers.parseEther(invoice.currPrice).toString(),
        });
    } catch (error) {
        console.error("Settle validation error:", error.message);
        return res.status(500).json({ error: "Settle validation failed" });
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

// GET /api/invoices/summary
export async function getBlockchainInvoices(req, res) {
    try {
        const summary = await getBlockchainSummary();

        return res.status(200).json(summary);
    } catch (error) {
        console.error("Blockchain summary error:", error.message);
        return res.status(500).json({ error: "Failed to fetch blockchain summary" });
    }
}