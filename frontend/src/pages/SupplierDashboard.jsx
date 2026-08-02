import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

// ─── helper: parse "DD-MM-YYYY" → Unix timestamp (midnight UTC) ───────────────
function parseDueDateToTimestamp(ddmmyyyy) {
    if (!ddmmyyyy || !/^\d{2}-\d{2}-\d{4}$/.test(ddmmyyyy)) return 0;
    const [dd, mm, yyyy] = ddmmyyyy.split("-");
    const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return Math.floor(date.getTime() / 1000);
}

// ─── helper: credit score → colour class ──────────────────────────────────────
function scoreColour(score) {
    if (score >= 80) return "#22c55e";  // green
    if (score >= 60) return "#f59e0b";  // amber
    return "#ef4444";                   // red
}

function SupplierDashboard() {
    const { account, provider, roles } = useWallet();
    const { getSignerContract, getReadOnlyContract } = useContract();

    // ── existing state ──────────────────────────────────────────────────────
    const [file, setFile] = useState(null);
    const [cid, setCid] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState("");

    const [mintBuyer, setMintBuyer] = useState("");
    const [mintAmount, setMintAmount] = useState("");
    const [mintDueDate, setMintDueDate] = useState("");
    const [minting, setMinting] = useState(false);
    const [mintMsg, setMintMsg] = useState("");

    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [listTokenId, setListTokenId] = useState("");
    const [listPrice, setListPrice] = useState("");
    const [listing, setListing] = useState(false);
    const [listMsg, setListMsg] = useState("");

    const [revokeTokenId, setRevokeTokenId] = useState("");
    const [revoking, setRevoking] = useState(false);
    const [revokeMsg, setRevokeMsg] = useState("");

    const [walletAddress, setWalletAddress] = useState("");
    const [walletBalance, setWalletBalance] = useState("0");

    // ── NEW: credit score state ─────────────────────────────────────────────
    const [creditProfile, setCreditProfile] = useState(null);
    const [loadingCredit, setLoadingCredit] = useState(false);

    // ── NEW: discount recommendation state ─────────────────────────────────
    const [recLoading, setRecLoading] = useState(false);
    const [recData, setRecData] = useState(null);          // { riskScore, recommendedDiscount, recommendedPriceEth }
    const [recTokenId, setRecTokenId] = useState("");      // tracks which tokenId rec was fetched for
    const [useRecommended, setUseRecommended] = useState(false);

    // ── ZK Phase-1 toggle ─────────────────────────────────────────
    const [zkEnabled, setZkEnabled] = useState(false); // supplier opts in to Groth16 private mode

    // ── fetch helpers ───────────────────────────────────────────────────────
    async function fetchInvoices() {
        if (!account) return;
        setLoadingInvoices(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/summary`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch invoices.");
            const results = (data.invoices || [])
                .filter((inv) => inv.creator.toLowerCase() === account.toLowerCase())
                .map((inv) => ({
                    tokenId: inv.tokenId,
                    buyer: inv.buyer,
                    invoiceAmount: inv.invoiceAmount,
                    currPrice: inv.currPrice,
                    dueDate: inv.dueDate,
                    isApproved: inv.isApproved,
                    forSale: inv.forSale,
                    currentOwner: inv.currentOwner,
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

    // ── NEW: fetch credit profile for the connected supplier ────────────────
    async function fetchCreditProfile() {
        if (!account) return;
        setLoadingCredit(true);
        try {
            const contract = getReadOnlyContract();
            const raw      = await contract.getCreditProfile(account);
            setCreditProfile({
                totalInvoices:    Number(raw.totalInvoices),
                approvedInvoices: Number(raw.approvedInvoices),
                fundedInvoices:   Number(raw.fundedInvoices),
                settledInvoices:  Number(raw.settledInvoices),
            });
        } catch (err) {
            console.error("Failed to fetch credit profile:", err.message);
        } finally {
            setLoadingCredit(false);
        }
    }

    useEffect(() => {
        fetchInvoices();
        refreshBalances();
        fetchCreditProfile();
    }, [account, provider]);

    // ── existing handlers ───────────────────────────────────────────────────
    async function handleUpload() {
        if (!file) return setUploadMsg("Please select a file.");
        setUploading(true);
        setUploadMsg("");
        try {
            const formData = new FormData();
            formData.append("invoice", file);
            const res = await fetch(`${BACKEND_URL}/api/invoices/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                setCid(data.cid);
                setUploadMsg(`✅ Uploaded. CID: ${data.cid}`);
            } else {
                setUploadMsg(`❌ Upload failed: ${getFriendlyErrorMessage(data.error)}`);
            }
        } catch (err) {
            setUploadMsg(`❌ ${getFriendlyErrorMessage(err, "Upload failed.")}`);
        } finally {
            setUploading(false);
        }
    }

    async function handleMint() {
        if (!account) return setMintMsg("Please connect your wallet.");
        if (!cid) return setMintMsg("Please upload an invoice first.");
        if (!mintBuyer || !mintAmount || !mintDueDate)
            return setMintMsg("Please fill all fields.");

        setMinting(true);
        setMintMsg("");
        try {
            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const amountWei = ethers.parseEther(mintAmount);
            const tx = await contract.mintInvoice(cid, mintBuyer, amountWei, mintDueDate);
            console.log("Mint tx hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);

            // ── NEW: extract tokenId from receipt and set the due-date timestamp ──
            const mintedEvent = receipt.logs
                ?.map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } })
                .find((e) => e?.name === "InvoiceMinted");

            if (mintedEvent) {
                const tokenId = mintedEvent.args.tokenId;
                const dueTs = parseDueDateToTimestamp(mintDueDate);
                if (dueTs > 0) {
                    try {
                        const tsTx = await contract.setInvoiceDueTimestamp(tokenId, dueTs);
                        await tsTx.wait();
                        console.log(`Due timestamp set for token ${tokenId}: ${dueTs}`);
                    } catch (tsErr) {
                        console.warn("Could not set due timestamp:", tsErr.message);
                    }
                }

                // ── ZK Phase 1: mark invoice as private if the supplier toggled it ──
                if (zkEnabled) {
                    try {
                        const zkTx = await contract.enablePrivateInvoice(tokenId);
                        await zkTx.wait();
                        console.log(`ZK enabled for token ${tokenId}`);
                    } catch (zkErr) {
                        console.warn("Could not enable ZK for invoice:", zkErr.message);
                    }
                }
                // ──────────────────────────────────────────────────────────────────
            }
            // ────────────────────────────────────────────────────────────────────

            setMintMsg(`✅ Invoice NFT minted successfully! Tx: ${tx.hash}`);
            setMintBuyer(""); setMintAmount(""); setMintDueDate("");
            setCid(""); setFile(null);
            fetchInvoices();
            refreshBalances();
            fetchCreditProfile();
        } catch (err) {
            console.error("Mint transaction failed:", err);
            setMintMsg(`❌ ${getFriendlyErrorMessage(err, "Minting failed.")}`);
        } finally {
            setMinting(false);
        }
    }

    // ── NEW: fetch discount recommendation for a token ───────────────────────
    async function handleGetRecommendation() {
        if (!listTokenId) return setListMsg("Enter a Token ID first.");
        setRecLoading(true);
        setRecData(null);
        setListMsg("");
        try {
            const contract = getReadOnlyContract();
            const result = await contract.recommendDiscount(listTokenId);
            const risk = Number(result[0]);
            const recPct = Number(result[1]);

            // Find the invoice to compute the recommended price in ETH
            const inv = invoices.find((i) => i.tokenId === Number(listTokenId));
            let recommendedPriceEth = "";
            if (inv) {
                const amountEth = parseFloat(inv.invoiceAmount);
                const discounted = amountEth * (1 - recPct / 100);
                recommendedPriceEth = discounted.toFixed(6);
            }

            setRecData({ riskScore: risk, recommendedDiscount: recPct, recommendedPriceEth });
            setRecTokenId(listTokenId);
        } catch (err) {
            setListMsg(`❌ ${getFriendlyErrorMessage(err, "Could not fetch recommendation.")}`);
        } finally {
            setRecLoading(false);
        }
    }

    function handleUseRecommended() {
        if (recData?.recommendedPriceEth) {
            setListPrice(recData.recommendedPriceEth);
            setUseRecommended(true);
        }
    }

    // ── updated: list invoice — uses WithRecommendation if rec was fetched ───
    async function handleList() {
        if (!account) return setListMsg("Please connect your wallet.");
        if (!listTokenId || !listPrice) return setListMsg("Please fill all fields.");

        const numPrice = Number(listPrice);
        if (isNaN(numPrice) || numPrice <= 0) {
            return setListMsg("Please enter a valid discounted price.");
        }

        const invoice = invoices.find((inv) => inv.tokenId === Number(listTokenId));
        if (invoice) {
            const invoiceAmountNum = Number(invoice.invoiceAmount);
            if (numPrice > invoiceAmountNum) {
                return setListMsg("The discounted price cannot exceed the original invoice amount.");
            }
        }

        setListing(true);
        setListMsg("");
        try {
            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const priceWei = ethers.parseEther(listPrice);

            let tx;
            // If recommendation was fetched for this exact tokenId, use the extended function
            if (recData && recTokenId === listTokenId) {
                tx = await contract.approveInvoiceSaleWithRecommendation(
                    listTokenId,
                    priceWei,
                    useRecommended
                );
            } else {
                // Fallback to original function (no recommendation data)
                tx = await contract.approveInvoiceSale(listTokenId, priceWei);
            }

            console.log("List tx hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);
            setListMsg(`✅ Invoice listed for sale! Tx: ${tx.hash}`);
            setListTokenId(""); setListPrice("");
            setRecData(null); setRecTokenId(""); setUseRecommended(false);
            fetchInvoices();
            refreshBalances();
            fetchCreditProfile();
        } catch (err) {
            console.error("List transaction failed:", err);
            setListMsg(`❌ ${getFriendlyErrorMessage(err, "Listing failed.")}`);
        } finally {
            setListing(false);
        }
    }

    async function handleRevoke() {
        if (!account) return setRevokeMsg("Please connect your wallet.");
        if (!revokeTokenId) return setRevokeMsg("Please enter a Token ID.");

        setRevoking(true);
        setRevokeMsg("");
        try {
            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const tx = await contract.revokeInvoiceSale(revokeTokenId);
            console.log("Revoke tx hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);
            setRevokeMsg(`✅ Listing revoked successfully! Tx: ${tx.hash}`);
            setRevokeTokenId("");
            fetchInvoices();
            refreshBalances();
        } catch (err) {
            console.error("Revoke transaction failed:", err);
            setRevokeMsg(`❌ ${getFriendlyErrorMessage(err, "Revoking failed.")}`);
        } finally {
            setRevoking(false);
        }
    }

    if (!account) {
        return (
            <div className="page">
                <h1>Supplier Dashboard</h1>
                <div className="section-card">
                    <p>Please connect your wallet to continue.</p>
                </div>
            </div>
        );
    }

    if (roles?.supplier && account.toLowerCase() !== roles.supplier) {
        return (
            <div className="page">
                <h1>Supplier Dashboard</h1>
                <div className="section-card">
                    <p>Please switch MetaMask to the Supplier account.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1>Supplier Dashboard</h1>
            <p className="subtitle-small">Connected: {account}</p>

            {/* ── Live Balances ─────────────────────────────────────────────────── */}
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

            {/* ── Supplier Performance Metrics ─────────────────────────────────────── */}
            <section className="section-card">
                <h2>
                    Supplier Performance Metrics&nbsp;
                    <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "4px 10px", marginLeft: "8px" }}
                        onClick={fetchCreditProfile}
                        disabled={loadingCredit}
                    >
                        {loadingCredit ? "Loading…" : "Refresh"}
                    </button>
                </h2>

                {creditProfile ? (() => {
                    const pct = (num, den) =>
                        den > 0 ? ((num / den) * 100).toFixed(0) + "%" : "—";
                    return (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: "16px 24px",
                            marginTop: "12px",
                        }}>
                            <div>
                                <span className="balance-label">Invoices Created</span><br />
                                <strong>{creditProfile.totalInvoices}</strong>
                            </div>
                            <div>
                                <span className="balance-label">Buyer Approval Rate</span><br />
                                <strong>{creditProfile.approvedInvoices} / {creditProfile.totalInvoices}</strong>
                                <span style={{ marginLeft: "8px", color: "#6b7280", fontSize: "0.85rem" }}>
                                    ({pct(creditProfile.approvedInvoices, creditProfile.totalInvoices)})
                                </span>
                            </div>
                            <div>
                                <span className="balance-label">Funding Success Rate</span><br />
                                <strong>{creditProfile.fundedInvoices} / {creditProfile.approvedInvoices}</strong>
                                <span style={{ marginLeft: "8px", color: "#6b7280", fontSize: "0.85rem" }}>
                                    ({pct(creditProfile.fundedInvoices, creditProfile.approvedInvoices)})
                                </span>
                            </div>
                            <div>
                                <span className="balance-label">Settlement Completion Rate</span><br />
                                <strong>{creditProfile.settledInvoices} / {creditProfile.fundedInvoices}</strong>
                                <span style={{ marginLeft: "8px", color: "#6b7280", fontSize: "0.85rem" }}>
                                    ({pct(creditProfile.settledInvoices, creditProfile.fundedInvoices)})
                                </span>
                            </div>
                        </div>
                    );
                })() : (
                    <p style={{ marginTop: "12px" }}>
                        {loadingCredit ? "Loading metrics…" : "No metrics yet. Create your first invoice."}
                    </p>
                )}
            </section>

            {/* ── Step 1 — Upload (unchanged) ───────────────────────────────── */}
            <section className="section-card">
                <h2>Step 1 — Upload Invoice to IPFS</h2>
                <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="file-input"
                />
                <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload to IPFS"}
                </button>
                {uploadMsg && <p className="form-msg">{uploadMsg}</p>}
            </section>

            {/* ── Step 2 — Mint (unchanged, but now also sets due timestamp) ── */}
            <section className="section-card">
                <h2>Step 2 — Mint Invoice NFT</h2>
                <div className="form-group">
                    <label>CID (auto-filled after upload)</label>
                    <input type="text" value={cid} onChange={(e) => setCid(e.target.value)}
                        placeholder="Qm... or bafk..." className="form-input" />
                </div>
                <div className="form-group">
                    <label>Buyer Address</label>
                    <input type="text" value={mintBuyer} onChange={(e) => setMintBuyer(e.target.value)}
                        placeholder="0x..." className="form-input" />
                </div>
                <div className="form-group">
                    <label>Invoice Amount (ETH)</label>
                    <input type="number" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)}
                        placeholder="1.0" className="form-input" />
                </div>
                <div className="form-group">
                    <label>Due Date (DD-MM-YYYY)</label>
                    <input type="text" value={mintDueDate} onChange={(e) => setMintDueDate(e.target.value)}
                        placeholder="31-12-2025" className="form-input" />
                </div>

                {/* ── ZK Phase 1 toggle ────────────────────────────────────────────── */}
                <div className="form-group" style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <input
                        id="zk-toggle"
                        type="checkbox"
                        checked={zkEnabled}
                        onChange={(e) => setZkEnabled(e.target.checked)}
                        style={{ marginTop: "3px", accentColor: "#6366f1", width: "16px", height: "16px", flexShrink: 0 }}
                    />
                    <div>
                        <label htmlFor="zk-toggle" style={{ fontWeight: 600, cursor: "pointer" }}>
                            Enable Private Invoice (Groth16 ZK)
                        </label>
                        <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#6b7280" }}>
                            Marks this invoice for zero-knowledge proof protection.
                            Proof generation is a Phase 2 feature — enabling this now
                            records the intent on-chain so the prover can act on it later.
                        </p>
                    </div>
                </div>
                {/* ────────────────────────────────────────────────────────────────── */}
                <button className="btn btn-primary" onClick={handleMint} disabled={minting}>
                    {minting ? "Minting..." : "Mint Invoice NFT"}
                </button>
                {mintMsg && <p className="form-msg">{mintMsg}</p>}
            </section>

            {/* ── Your Invoices (unchanged) ─────────────────────────────────── */}
            <section className="section-card">
                <h2>Your Invoices</h2>
                <button className="btn btn-secondary" onClick={fetchInvoices}>Refresh</button>
                {loadingInvoices ? (
                    <p>Loading...</p>
                ) : invoices.length === 0 ? (
                    <p style={{ marginTop: "12px" }}>No invoices found.</p>
                ) : (
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Token ID</th>
                                <th>Amount</th>
                                <th>Due Date</th>
                                <th>Approved</th>
                                <th>For Sale</th>
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
                                        <Link to={`/invoice/${inv.tokenId}`} className="btn btn-secondary">View</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {/* ── NEW: List Invoice for Sale — with Discount Recommendation ─── */}
            <section className="section-card">
                <h2>List Invoice for Sale</h2>

                <div className="form-group">
                    <label>Token ID</label>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                            type="number"
                            value={listTokenId}
                            onChange={(e) => {
                                setListTokenId(e.target.value);
                                // Clear stale recommendation when token changes
                                if (e.target.value !== recTokenId) {
                                    setRecData(null);
                                    setUseRecommended(false);
                                }
                            }}
                            placeholder="0"
                            className="form-input"
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn btn-secondary"
                            onClick={handleGetRecommendation}
                            disabled={recLoading || !listTokenId}
                            style={{ whiteSpace: "nowrap" }}
                        >
                            {recLoading ? "Fetching…" : "Get Recommendation"}
                        </button>
                    </div>
                </div>

                {/* Recommendation result panel */}
                {recData && recTokenId === listTokenId && (
                    <div style={{
                        background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        borderRadius: "8px",
                        padding: "14px 16px",
                        marginBottom: "12px"
                    }}>
                        <p style={{ fontWeight: 600, marginBottom: "8px" }}>
                            🤖 Discount Engine Recommendation
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                            <div>
                                <span className="balance-label">Buyer Risk Score</span><br />
                                <strong style={{ color: scoreColour(100 - recData.riskScore) }}>
                                    {recData.riskScore} / 100
                                </strong>
                            </div>
                            <div>
                                <span className="balance-label">Recommended Discount</span><br />
                                <strong>{recData.recommendedDiscount}%</strong>
                            </div>
                            <div>
                                <span className="balance-label">Recommended Price</span><br />
                                <strong>{recData.recommendedPriceEth || "—"} ETH</strong>
                            </div>
                        </div>
                        <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                            <button
                                className="btn btn-primary"
                                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                                onClick={handleUseRecommended}
                            >
                                ✓ Use Recommended Price
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                                onClick={() => setUseRecommended(false)}
                            >
                                Enter Manual Price
                            </button>
                        </div>
                        {useRecommended && (
                            <p style={{ marginTop: "8px", fontSize: "0.8rem", color: "#22c55e" }}>
                                ✅ Using engine recommendation — discount data will be stored on-chain.
                            </p>
                        )}
                        {!useRecommended && listPrice && recData && (
                            <p style={{ marginTop: "8px", fontSize: "0.8rem", color: "#f59e0b" }}>
                                ⚠️ Manual override — your price will be stored alongside the recommendation.
                            </p>
                        )}
                    </div>
                )}

                <div className="form-group">
                    <label>Discounted Price (ETH)</label>
                    <input
                        type="number"
                        value={listPrice}
                        onChange={(e) => {
                            setListPrice(e.target.value);
                            // If supplier types a different price, mark as override
                            if (recData && e.target.value !== recData.recommendedPriceEth) {
                                setUseRecommended(false);
                            }
                        }}
                        placeholder="0.8"
                        className="form-input"
                    />
                </div>

                <button className="btn btn-primary" onClick={handleList} disabled={listing}>
                    {listing ? "Listing..." : "List for Sale"}
                </button>
                {listMsg && <p className="form-msg">{listMsg}</p>}
            </section>

            {/* ── Revoke Listing (unchanged) ────────────────────────────────── */}
            <section className="section-card">
                <h2>Revoke Listing</h2>
                <div className="form-group">
                    <label>Token ID</label>
                    <input
                        type="number"
                        value={revokeTokenId}
                        onChange={(e) => setRevokeTokenId(e.target.value)}
                        placeholder="0"
                        className="form-input"
                    />
                </div>
                <button className="btn btn-secondary" onClick={handleRevoke} disabled={revoking}>
                    {revoking ? "Revoking..." : "Revoke Listing"}
                </button>
                {revokeMsg && <p className="form-msg">{revokeMsg}</p>}
            </section>
        </div>
    );
}

export default SupplierDashboard;