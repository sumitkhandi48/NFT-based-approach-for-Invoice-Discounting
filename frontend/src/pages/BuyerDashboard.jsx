import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

function BuyerDashboard() {
    const { account, provider } = useWallet();
    const { getSignerContract, getReadOnlyProvider, CONTRACT_ADDRESS } = useContract();

    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [signTokenId, setSignTokenId] = useState("");
    const [signing, setSigning] = useState(false);
    const [signMsg, setSignMsg] = useState("");

    const [settleTokenId, setSettleTokenId] = useState("");
    const [settling, setSettling] = useState(false);
    const [settleMsg, setSettleMsg] = useState("");

    const [walletAddress, setWalletAddress] = useState("");
    const [walletBalance, setWalletBalance] = useState("0");

    async function fetchAssignedInvoices() {
        if (!account) return;
        setLoadingInvoices(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/summary`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch invoices.");
            }

            const results = (data.invoices || [])
                .filter((invoice) => invoice.buyer.toLowerCase() === account.toLowerCase())
                .map((invoice) => ({
                    tokenId: invoice.tokenId,
                    creator: invoice.creator,
                    invoiceAmount: invoice.invoiceAmount,
                    currPrice: invoice.currPrice,
                    dueDate: invoice.dueDate,
                    isApproved: invoice.isApproved,
                    forSale: invoice.forSale,
                    currentOwner: invoice.currentOwner,
                    isSettled:
                        invoice.currentOwner.toLowerCase() === account.toLowerCase() && invoice.isApproved,
                }));

            setInvoices(results);
        } catch (err) {
            console.error("Failed to fetch invoices:", err.message);
        } finally {
            setLoadingInvoices(false);
        }
    }

    async function refreshBalances() {
        if (!account || !provider) {
            setWalletAddress("");
            setWalletBalance("0");
            return;
        }

        const signer = await provider.getSigner();
        const activeAddress = await signer.getAddress();
        const walletWei = await provider.getBalance(activeAddress);

        setWalletAddress(activeAddress);
        setWalletBalance(ethers.formatEther(walletWei));
    }

    useEffect(() => {
        fetchAssignedInvoices();
        refreshBalances();
    }, [account, provider]);

    async function handleSign() {
        if (!account) return setSignMsg("Please connect your wallet.");
        if (!signTokenId) return setSignMsg("Please enter a Token ID.");

        setSigning(true);
        setSignMsg("");
        try {
            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const tx = await contract.signInvoice(signTokenId);
            console.log("Transaction Hash:", tx.hash);
            console.log("Waiting for confirmation...");
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);
            setSignMsg(`✅ Invoice signed successfully! Tx: ${tx.hash}`);
            setSignTokenId("");
            fetchAssignedInvoices();
            refreshBalances();
        } catch (err) {
            console.error("Sign transaction failed:", err);
            setSignMsg(`❌ ${getFriendlyErrorMessage(err, "Signing failed.")}`);
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
                return setSettleMsg(`❌ ${getFriendlyErrorMessage(data.error, "Settlement failed.")}`);
            }

            const signer = await provider.getSigner();
            const signerAddress = await signer.getAddress();
            const contract = getSignerContract(signer);
            const priceWei = ethers.parseEther(data.invoice.currPrice);
            const readProvider = getReadOnlyProvider();

            console.log("Connected Account:", account);
            console.log("Signer Address:", signerAddress);

            const buyerBefore = await readProvider.getBalance(signerAddress);
            const ownerBefore = await readProvider.getBalance(data.invoice.currentOwner);
            const contractBefore = await readProvider.getBalance(CONTRACT_ADDRESS);

            console.log("[settleInvoice] tokenId:", settleTokenId);
            console.log("[settleInvoice] invoice price (ETH):", data.invoice.currPrice);
            console.log("[settleInvoice] msg.value (wei):", priceWei.toString());
            console.log("[settleInvoice] buyer balance before:", ethers.formatEther(buyerBefore));
            console.log("[settleInvoice] supplier balance before:", ethers.formatEther(ownerBefore));
            console.log("[settleInvoice] contract balance before:", ethers.formatEther(contractBefore));

            const tx = await contract.settleInvoice(settleTokenId, { value: priceWei });
            console.log("Transaction Hash:", tx.hash);
            console.log("Waiting for confirmation...");
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);

            const buyerAfter = await readProvider.getBalance(signerAddress);
            const ownerAfter = await readProvider.getBalance(data.invoice.currentOwner);
            const contractAfter = await readProvider.getBalance(CONTRACT_ADDRESS);

            console.log("[settleInvoice] tx hash:", tx.hash);
            console.log("[settleInvoice] gas used:", receipt?.gasUsed?.toString?.() ?? "n/a");
            console.log("[settleInvoice] buyer balance after:", ethers.formatEther(buyerAfter));
            console.log("[settleInvoice] supplier balance after:", ethers.formatEther(ownerAfter));
            console.log("[settleInvoice] contract balance after:", ethers.formatEther(contractAfter));

            setSettleMsg(`✅ Invoice settled successfully! Tx: ${tx.hash}`);
            setSettleTokenId("");
            fetchAssignedInvoices();
            refreshBalances();
        } catch (err) {
            console.error("Settle transaction failed:", err);
            setSettleMsg(`❌ ${getFriendlyErrorMessage(err, "Settlement failed.")}`);
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

            <section className="section-card balance-card">
                <h2>Live Balances</h2>
                <div className="balance-grid">
                    <div className="balance-item">
                        <span className="balance-label">Connected Wallet Address</span>
                        <strong>{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}</strong>
                    </div>
                    <div className="balance-item">
                        <span className="balance-label">Wallet Balance</span>
                        <strong>{walletBalance} ETH</strong>
                    </div>
                </div>
            </section>

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