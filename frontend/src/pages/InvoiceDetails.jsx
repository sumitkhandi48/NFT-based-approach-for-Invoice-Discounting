import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

function InvoiceDetails() {
    const { tokenId } = useParams();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchInvoice() {
            try {
                setLoading(true);
                const res = await fetch(`${BACKEND_URL}/api/invoices/${tokenId}`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Invoice not found.");
                }

                setInvoice({
                    ...data.invoice,
                });
            } catch (err) {
                setError(getFriendlyErrorMessage(err, "Invoice not found or could not be fetched."));
            } finally {
                setLoading(false);
            }
        }

        fetchInvoice();
    }, [tokenId]);

    if (loading) return <div className="page"><p>Loading invoice...</p></div>;
    if (error) return <div className="page"><p className="error-msg">{error}</p></div>;

    return (
        <div className="page">
            <h1>Invoice Details</h1>
            <p className="subtitle-small">Token ID: {tokenId}</p>

            <section className="section-card">
                <table className="details-table">
                    <tbody>
                        <tr>
                            <td>Token ID</td>
                            <td>{invoice.tokenId}</td>
                        </tr>
                        <tr>
                            <td>CID (IPFS)</td>
                            <td>
                                <a href={invoice.ipfsUrl} target="_blank" rel="noreferrer">
                                    {invoice.ipfsCID}
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>Source</td>
                            <td>{invoice.source || "blockchain"}</td>
                        </tr>
                        <tr>
                            <td>Invoice Amount</td>
                            <td>
                                {invoice.invoiceAmount !== null 
                                    ? `${invoice.invoiceAmount} ETH` 
                                    : (localStorage.getItem(`zk_invoice_amount_${invoice.tokenId}`) 
                                        ? `${localStorage.getItem(`zk_invoice_amount_${invoice.tokenId}`)} ETH (🔒 Private)` 
                                        : "🔒 Private")}
                            </td>
                        </tr>
                        <tr>
                            <td>Current Price</td>
                            <td>{invoice.currPrice} ETH</td>
                        </tr>
                        <tr>
                            <td>Due Date</td>
                            <td>{invoice.dueDate}</td>
                        </tr>
                        <tr>
                            <td>Creator</td>
                            <td>{invoice.creator}</td>
                        </tr>
                        <tr>
                            <td>Buyer</td>
                            <td>{invoice.buyer}</td>
                        </tr>
                        <tr>
                            <td>Current Owner</td>
                            <td>{invoice.currentOwner}</td>
                        </tr>
                        <tr>
                            <td>Stage</td>
                            <td>{invoice.stage}</td>
                        </tr>
                        <tr>
                            <td>Mint Tx Hash</td>
                            <td>{invoice.mintTxHash || "N/A"}</td>
                        </tr>
                        <tr>
                            <td>Mint Block</td>
                            <td>{invoice.mintBlock ?? "N/A"}</td>
                        </tr>
                        <tr>
                            <td>Approved Status</td>
                            <td>
                                <span className={invoice.isApproved ? "badge badge-green" : "badge badge-grey"}>
                                    {invoice.isApproved ? "Approved" : "Pending"}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td>For Sale</td>
                            <td>
                                <span className={invoice.forSale ? "badge badge-blue" : "badge badge-grey"}>
                                    {invoice.forSale ? "Listed" : "Not Listed"}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <Link to="/dashboard" className="btn btn-secondary">
                Back to Dashboard
            </Link>
        </div>
    );
}

export default InvoiceDetails;