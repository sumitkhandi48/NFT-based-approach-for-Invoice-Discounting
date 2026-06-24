import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";

const BACKEND_URL = "http://localhost:3000";

function BuyerDashboard() {
    const { account, provider } = useWallet();
    const { getReadOnlyContract, getSignerContract } = useContract();

    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [signTokenId, setSignTokenId] = useState("");
    const [signing, setSigning] = useState(false);
    const [signMsg, setSignMsg] = useState("");

    const [settleTokenId, setSettleTokenId] = useState("");
    const [settling, setSettling] = useState(false);
    const [settleMsg, setSettleMsg] = useState("");

    async function fetchAssignedInvoices() {
        if (!account) return;
        setLoadingInvoices(true);
        try {
            const contract = getReadOnlyContract();
            const results = [];

            for (let i = 0; i < 50; i++) {
                try {
                    const owner = await contract.ownerOf(i);
                    const data = await contract.InvoiceNFT_Map(i);
                    if (data.buyer.toLowerCase() === account.toLowerCase()) {
                        // isSettled = buyer is current owner AND invoice is approved
                        const isSettled =
                            owner.toLowerCase() === account.toLowerCase() && data.isApproved;

                        results.push({
                            tokenId: i,
                            creator: data.creator,
                            invoiceAmount: ethers.formatEther(data.invoiceAmount),
                            currPrice: ethers.formatEther(data.currPrice),
                            dueDate: data.dueDate,
                            isApproved: data.isApproved,
                            forSale: data.forSale,
                            owner,
                            isSettled,
                        });
                    }
                } catch {
                    break;
                }
            }
            setInvoices(results);
        } catch (err) {
            console.error("Failed to fetch invoices:", err.message);
        } finally {
            setLoadingInvoices(false);
        }
    }

    useEffect(() => {
        fetchAssignedInvoices();
    }, [account]);

    async function handleSign() {
        if (!account) return setSignMsg("Please connect your wallet.");
        if (!signTokenId) return setSignMsg("Please enter a Token ID.");

        setSigning(true);
        setSignMsg("");
        try {
            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const tx = await contract.signInvoice(signTokenId);
            await tx.wait();
            setSignMsg("✅ Invoice signed successfully!");
            setSignTokenId("");
            fetchAssignedInvoices();
        } catch (err) {
            setSignMsg(`❌ Error: ${err.message}`);
        } finally {
            setSigning(false);
        }
    }

    async function handleSettle() {
        if (!account) return setSettleMsg("Please connect your wallet.");
        if (!settleTokenId) return setSettleMsg("Please enter a Token ID.");

        // Check if already settled
        const invoice = invoices.find((inv) => inv.tokenId === Number(settleTokenId));
        if (invoice && invoice.isSettled) {
            return setSettleMsg("❌ This invoice has already been settled.");
        }

        setSettling(true);
        setSettleMsg("");
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/settle`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokenId: Number(settleTokenId) }),
            });
            const data = await res.json();

            if (!data.success) {
                return setSettleMsg(`❌ ${data.error}`);
            }

            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const priceWei = BigInt(data.invoice.currPrice);
            const tx = await contract.settleInvoice(settleTokenId, { value: priceWei });
            await tx.wait();
            setSettleMsg("✅ Invoice settled successfully!");
            setSettleTokenId("");
            fetchAssignedInvoices();
        } catch (err) {
            setSettleMsg(`❌ Error: ${err.message}`);
        } finally {
            setSettling(false);
        }
    }

    if (!account) {
        return (
            <div className="page">
                <h1>Buyer Dashboard</h1>
                <div className="section-card">
                    <p>Please connect your wallet to continue.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1>Buyer Dashboard</h1>
            <p className="subtitle-small">Connected: {account}</p>

            {/* Assigned Invoices */}
            <section className="section-card">
                <h2>Assigned Invoices</h2>
                <button className="btn btn-secondary" onClick={fetchAssignedInvoices}>
                    Refresh
                </button>
                {loadingInvoices ? (
                    <p>Loading...</p>
                ) : invoices.length === 0 ? (
                    <p style={{ marginTop: "12px" }}>No invoices assigned to you.</p>
                ) : (
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Token ID</th>
                                <th>Amount</th>
                                <th>Due Date</th>
                                <th>Approved</th>
                                <th>For Sale</th>
                                <th>Settled</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((inv) => (
                                <tr key={inv.tokenId}>
                                    <td>{inv.tokenId}</td>
                                    <td>{inv.invoiceAmount} ETH</td>
                                    <td>{inv.dueDate}</td>
                                    <td>
                                        <span className={inv.isApproved ? "badge badge-green" : "badge badge-grey"}>
                                            {inv.isApproved ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={inv.forSale ? "badge badge-blue" : "badge badge-grey"}>
                                            {inv.forSale ? "Listed" : "No"}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={inv.isSettled ? "badge badge-green" : "badge badge-grey"}>
                                            {inv.isSettled ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td>
                                        <Link to={`/invoice/${inv.tokenId}`} className="btn btn-secondary">
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* Sign Invoice */}
            <section className="section-card">
                <h2>Sign Invoice</h2>
                <p style={{ marginBottom: "12px", color: "#4a4a4a" }}>
                    Approve an invoice assigned to you by the supplier.
                </p>
                <div className="form-group">
                    <label>Token ID</label>
                    <input
                        type="number"
                        value={signTokenId}
                        onChange={(e) => setSignTokenId(e.target.value)}
                        placeholder="0"
                        className="form-input"
                    />
                </div>
                <button className="btn btn-primary" onClick={handleSign} disabled={signing}>
                    {signing ? "Signing..." : "Sign Invoice"}
                </button>
                {signMsg && <p className="form-msg">{signMsg}</p>}
            </section>

            {/* Settle Invoice */}
            <section className="section-card">
                <h2>Settle Invoice</h2>
                <p style={{ marginBottom: "12px", color: "#4a4a4a" }}>
                    Settle an invoice on or after its due date.
                </p>
                <div className="form-group">
                    <label>Token ID</label>
                    <input
                        type="number"
                        value={settleTokenId}
                        onChange={(e) => setSettleTokenId(e.target.value)}
                        placeholder="0"
                        className="form-input"
                    />
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSettle}
                    disabled={
                        settling ||
                        (settleTokenId !== "" &&
                            invoices.find((inv) => inv.tokenId === Number(settleTokenId))
                                ?.isSettled)
                    }
                >
                    {settling ? "Settling..." : "Settle Invoice"}
                </button>
                {settleMsg && <p className="form-msg">{settleMsg}</p>}
            </section>
        </div>
    );
}

export default BuyerDashboard;