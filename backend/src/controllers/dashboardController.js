import { getBlockchainSummary } from "../services/blockchainService.js";

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderInvoiceRows(invoices, emptyMessage) {
    if (!invoices.length) {
        return `<tr><td colspan="8" class="empty-row">${escapeHtml(emptyMessage)}</td></tr>`;
    }

    return invoices
        .map(
            (invoice) => `
                <tr>
                    <td>${invoice.tokenId}</td>
                    <td>${escapeHtml(invoice.currentOwner)}</td>
                    <td>${escapeHtml(invoice.creator)}</td>
                    <td>${escapeHtml(invoice.buyer)}</td>
                    <td>${invoice.invoiceAmount} ETH</td>
                    <td>${invoice.currPrice} ETH</td>
                    <td>${escapeHtml(invoice.stage)}</td>
                    <td>${invoice.forSale ? "Yes" : "No"}</td>
                </tr>
            `
        )
        .join("");
}

function renderMarketplaceRows(invoices, emptyMessage) {
    if (!invoices.length) {
        return `<tr><td colspan="7" class="empty-row">${escapeHtml(emptyMessage)}</td></tr>`;
    }

    return invoices
        .map(
            (invoice) => `
                <tr>
                    <td>${invoice.tokenId}</td>
                    <td>${escapeHtml(invoice.currentOwner)}</td>
                    <td>${invoice.currPrice} ETH</td>
                    <td>${escapeHtml(invoice.dueDate)}</td>
                    <td>${escapeHtml(invoice.stage)}</td>
                    <td>${escapeHtml(invoice.mintTxHash || "N/A")}</td>
                    <td>${invoice.mintBlock ?? "N/A"}</td>
                </tr>
            `
        )
        .join("");
}

function renderDashboardPage(summary) {
    const summaryJson = escapeHtml(JSON.stringify(summary, null, 2));

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice Discounting API</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: "Segoe UI", Arial, sans-serif;
            background: #f5f6f8;
            color: #18212f;
        }
        .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
        h1 { margin: 0 0 8px; font-size: 1.9rem; }
        p { margin: 0 0 12px; color: #64748b; }
        .links { margin: 12px 0 16px; }
        a { color: #2563eb; }
        pre {
            margin: 0;
            padding: 16px;
            background: #111827;
            color: #e5e7eb;
            border-radius: 8px;
            overflow: auto;
            font-size: 0.88rem;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="wrap">
        <h1>Invoice Discounting API</h1>
        <p>Backend console output.</p>
        <div class="links">
            <a href="/api/invoices/summary" target="_blank" rel="noreferrer">/api/invoices/summary</a>
            <span> | </span>
            <a href="/api/invoices/marketplace" target="_blank" rel="noreferrer">/api/invoices/marketplace</a>
            <span> | </span>
            <a href="/api/invoices/0" target="_blank" rel="noreferrer">/api/invoices/0</a>
        </div>
        <pre>${summaryJson}</pre>
    </div>
</body>
</html>`;
}

export async function renderDashboard(req, res) {
    try {
        const summary = await getBlockchainSummary();
        res.type("html").send(renderDashboardPage(summary));
    } catch (error) {
        console.error("Dashboard render error:", error.message);
        res.status(500).type("html").send(`
            <html>
                <body style="font-family: sans-serif; padding: 24px;">
                    <h1>Backend dashboard unavailable</h1>
                    <p>${escapeHtml(error.message)}</p>
                </body>
            </html>
        `);
    }
}

export async function getMarketplaceInvoices(req, res) {
    try {
        const summary = await getBlockchainSummary();
        const marketplaceInvoices = summary.invoices.filter((invoice) => invoice.forSale);

        res.json({
            source: summary.source,
            totalMinted: summary.totalMinted,
            totalListed: marketplaceInvoices.length,
            invoices: marketplaceInvoices,
        });
    } catch (error) {
        console.error("Marketplace summary error:", error.message);
        res.status(500).json({ error: "Failed to fetch marketplace invoices" });
    }
}