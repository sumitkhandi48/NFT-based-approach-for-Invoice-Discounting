import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useContract } from "../context/ContractContext.jsx";

function InvoiceDetails() {
    const { tokenId } = useParams();
    const { getReadOnlyContract } = useContract();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchInvoice() {
            try {
                setLoading(true);
                const contract = getReadOnlyContract();
                const data = await contract.InvoiceNFT_Map(tokenId);
                const tokenURI = await contract.tokenURI(tokenId);
                const owner = await contract.ownerOf(tokenId);

                setInvoice({
                    tokenId,
                    creator: data.creator,
                    buyer: data.buyer,
                    currPrice: ethers.formatEther(data.currPrice),
                    invoiceAmount: ethers.formatEther(data.invoiceAmount),
                    dueDate: data.dueDate,
                    isApproved: data.isApproved,
                    forSale: data.forSale,
                    tokenURI,
                    owner,
                });
            } catch (err) {
                setError("Invoice not found or could not be fetched.");
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
                                <a
                                    href={`https://gateway.pinata.cloud/ipfs/${invoice.tokenURI}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {invoice.tokenURI}
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>Invoice Amount</td>
                            <td>{invoice.invoiceAmount} ETH</td>
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
                            <td>{invoice.owner}</td>
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