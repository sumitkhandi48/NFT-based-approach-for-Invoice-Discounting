import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

// ─── helper: credit score → colour ────────────────────────────────────────────
function scoreColour(score) {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
}

// ─── helper: credit score → label ─────────────────────────────────────────────
function scoreLabel(score) {
    if (score >= 80) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 50) return "Fair";
    return "Poor";
}

function BuyerDashboard() {
    const { account, provider, roles } = useWallet();
    const { getSignerContract, getReadOnlyContract, getReadOnlyProvider, CONTRACT_ADDRESS } = useContract();

    // ── existing state ──────────────────────────────────────────────────────
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

    // ── NEW: credit profile state ───────────────────────────────────────────
    const [creditProfile, setCreditProfile] = useState(null);
    const [loadingCredit, setLoadingCredit] = useState(false);

    // ── fetch helpers ───────────────────────────────────────────────────────
    async function fetchAssignedInvoices() {
        if (!account) return;
        setLoadingInvoices(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/summary`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch invoices.");
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
                        invoice.currentOwner.toLowerCase() === account.toLowerCase() &&
                        invoice.isApproved,
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

    // ── NEW: fetch the buyer's own credit profile ───────────────────────────
    async function fetchCreditProfile() {
        if (!account) return;
        setLoadingCredit(true);
        try {
            const contract  = getReadOnlyContract();
            const raw       = await contract.getCreditProfile(account);
            const scoreVal  = await contract.getBuyerBBCS(account);
            setCreditProfile({
                score:                 Number(scoreVal),
                totalInvoices:         Number(raw.totalInvoices),
                successfulSettlements: Number(raw.successfulSettlements),
                lateSettlements:       Number(raw.lateSettlements),
                defaults:              Number(raw.defaults),
                totalFundingReceived:  ethers.formatEther(raw.totalFundingReceived),
                totalFundingProvided:  ethers.formatEther(raw.totalFundingProvided),
            });
        } catch (err) {
            console.error("Failed to fetch BBCS:", err.message);
        } finally {
            setLoadingCredit(false);
        }
    }

    useEffect(() => {
        fetchAssignedInvoices();
        refreshBalances();
        fetchCreditProfile();
    }, [account, provider]);

    // ── existing handlers ───────────────────────────────────────────────────
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
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);
            setSignMsg(`✅ Invoice signed successfully! Tx: ${tx.hash}`);
            setSignTokenId("");
            fetchAssignedInvoices();
            refreshBalances();
            fetchCreditProfile();
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
            fetchCreditProfile();
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

    if (roles?.buyer && account.toLowerCase() !== roles.buyer) {
        return (
            <div className="page">
                <h1>Buyer Dashboard</h1>
                <div className="section-card">
                    <p>Please switch MetaMask to the Buyer account.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1>Buyer Dashboard</h1>
            <p className="subtitle-small">Connected: {account}</p>

            {/* ── Live Balances (unchanged) ─────────────────────────────────── */}
            <section className="section-card balance-card">
                <h2>Live Balances</h2>
                <div className="balance-grid">
                    <div className="balance-item">
                        <span className="balance-label">Connected Wallet Address</span>
                        <strong>
                            {walletAddress
                                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                                : "Not connected"}
                        </strong>
                    </div>
                    <div className="balance-item">
                        <span className="balance-label">Wallet Balance</span>
                        <strong>{walletBalance} ETH</strong>
                    </div>
                </div>
            </section>

            {/* ── BBCS Panel ────────────────────────────────────────────────── */}
            <section className="section-card">
                <h2>
                    Blockchain Behavioral Credit Score (BBCS)&nbsp;
                    <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "4px 10px", marginLeft: "8px" }}
                        onClick={fetchCreditProfile}
                        disabled={loadingCredit}
                    >
                        {loadingCredit ? "Loading…" : "Refresh"}
                    </button>
                </h2>

                {creditProfile ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "12px" }}>

                        {/* Score badge */}
                        <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", width: "110px", height: "110px",
                            borderRadius: "50%",
                            background: `conic-gradient(${scoreColour(creditProfile.score)} ${creditProfile.score * 3.6}deg, #e5e7eb 0deg)`,
                            position: "relative", flexShrink: 0,
                        }}>
                            <div style={{
                                position: "absolute", width: "82px", height: "82px",
                                borderRadius: "50%", background: "var(--bg-card, #fff)",
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                            }}>
                                <span style={{ fontWeight: 700, fontSize: "1.6rem", color: scoreColour(creditProfile.score) }}>
                                    {creditProfile.score}
                                </span>
                                <span style={{ fontSize: "0.6rem", color: "#6b7280" }}>
                                    {scoreLabel(creditProfile.score)}
                                </span>
                            </div>
                        </div>

                        {/* Stats */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "8px 24px",
                            alignContent: "center",
                            flex: 1,
                        }}>
                            <div>
                                <span className="balance-label">Successful Settlements</span><br />
                                <strong>{creditProfile.successfulSettlements}</strong>
                            </div>
                            <div>
                                <span className="balance-label">Late Settlements</span><br />
                                <strong style={{ color: creditProfile.lateSettlements > 0 ? "#f59e0b" : "inherit" }}>
                                    {creditProfile.lateSettlements}
                                </strong>
                            </div>
                            <div>
                                <span className="balance-label">Defaults</span><br />
                                <strong style={{ color: creditProfile.defaults > 0 ? "#ef4444" : "inherit" }}>
                                    {creditProfile.defaults}
                                </strong>
                            </div>
                            <div>
                                <span className="balance-label">Total Invoices Assigned</span><br />
                                <strong>{creditProfile.totalInvoices}</strong>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p style={{ marginTop: "12px" }}>
                        {loadingCredit ? "Loading credit profile…" : "No credit profile found."}
                    </p>
                )}

                {/* BBCS legend */}
                {creditProfile && (
                    <div style={{
                        marginTop: "14px",
                        padding: "10px 14px",
                        background: "rgba(0,0,0,0.03)",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        color: "#6b7280",
                    }}>
                        <span>
                            Your BBCS is computed dynamically from on-chain behaviour.
                            On-time settlements improve your score, while late settlements
                            and defaults reduce it. New buyers start at a neutral score of 75.
                        </span>
                    </div>
                )}
            </section>

            {/* ── Assigned Invoices (unchanged) ────────────────────────────── */}
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

            {/* ── Sign Invoice (unchanged) ──────────────────────────────────── */}
            <section className="section-card">
                <h2>Sign Invoice</h2>
                <p style={{ marginBottom: "12px", color: "#4a4a4a" }}>
                    Approve an invoice assigned to you by the supplier.
                    <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "#22c55e" }}>
                        (+2 credit score on signing)
                    </span>
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

            {/* ── Settle Invoice (unchanged) ────────────────────────────────── */}
            <section className="section-card">
                <h2>Settle Invoice</h2>
                <p style={{ marginBottom: "12px", color: "#4a4a4a" }}>
                    Repay the financier by settling the invoice. Settling on or before the due date increases the buyer's credit score, while settling after the due date reduces it.
                    <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "#6b7280" }}>
                        (On-time: <span style={{ color: "#22c55e" }}>+5</span> | Late: <span style={{ color: "#ef4444" }}>−5</span> credit score)
                    </span>
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