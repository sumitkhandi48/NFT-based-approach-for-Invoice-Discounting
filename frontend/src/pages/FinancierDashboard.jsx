import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

// ─── helpers ──────────────────────────────────────────────────────────────────
function scoreColour(score) {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
}

function scoreLabel(score) {
    if (score >= 80) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 50) return "Fair";
    return "Poor";
}

// Small inline badge used in the table column
function ScoreBadge({ score }) {
    if (score === null) {
        return <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>…</span>;
    }
    return (
        <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "12px",
            background: scoreColour(score),
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.8rem",
            minWidth: "36px",
            textAlign: "center",
        }}>
            {score}
        </span>
    );
}

function FinancierDashboard() {
    const { account, provider, roles } = useWallet();
    const { getSignerContract, getReadOnlyContract, getReadOnlyProvider, CONTRACT_ADDRESS } = useContract();

    // ── existing state ──────────────────────────────────────────────────────
    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [buyTokenId, setBuyTokenId] = useState("");
    const [buying, setBuying]         = useState(false);
    const [buyMsg, setBuyMsg]         = useState("");

    // ── ZK Phase-3: proof verification state ─────────────────────────────
    const [zkVerifyTokenId, setZkVerifyTokenId]   = useState("");
    const [zkVerifying, setZkVerifying]           = useState(false);
    const [zkVerifyResult, setZkVerifyResult]     = useState(null);   // { verified, verificationTimeMs, proofStatus }
    const [zkVerifyMsg, setZkVerifyMsg]           = useState("");

    const [walletAddress, setWalletAddress] = useState("");
    const [walletBalance, setWalletBalance] = useState("0");

    // ── NEW: financier's own credit profile ────────────────────────────────
    const [creditProfile, setCreditProfile] = useState(null);
    const [loadingCredit, setLoadingCredit] = useState(false);

    // ── NEW: per-invoice buyer credit scores { tokenId: score|null } ────────
    const [buyerScores, setBuyerScores] = useState({});

    // \u2500\u2500 ZK Phase-1: per-invoice ZK metadata { tokenId: { zkEnabled, proofStatus } }
    const [zkData, setZkData] = useState({});

    // ── fetch helpers ───────────────────────────────────────────────────────
    async function fetchListedInvoices() {
        setLoadingInvoices(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/summary`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch invoices.");

            const results = (data.invoices || [])
                .filter((invoice) => invoice.forSale)
                .map((invoice) => ({
                    tokenId: invoice.tokenId,
                    creator: invoice.creator,
                    buyer: invoice.buyer,
                    invoiceAmount: invoice.invoiceAmount,
                    currPrice: invoice.currPrice,
                    dueDate: invoice.dueDate,
                    isApproved: invoice.isApproved,
                    currentOwner: invoice.currentOwner,
                }));

            setInvoices(results);

            // NEW: fetch buyer credit scores + ZK metadata for all listed invoices
            fetchBuyerScores(results);
            fetchZKData(results);
        } catch (err) {
            console.error("Failed to fetch listed invoices:", err.message);
        } finally {
            setLoadingInvoices(false);
        }
    }

    // ── NEW: bulk-fetch buyer credit scores ─────────────────────────────────
    async function fetchBuyerScores(invoiceList) {
        if (!invoiceList || invoiceList.length === 0) return;
        try {
            const contract = getReadOnlyContract();
            // Initialise all to null (loading state)
            const initial = {};
            invoiceList.forEach((inv) => { initial[inv.tokenId] = null; });
            setBuyerScores(initial);

            const scores = await Promise.all(
                invoiceList.map(async (inv) => {
                    try {
                        const score = await contract.getCreditScore(inv.buyer);
                        return { tokenId: inv.tokenId, score: Number(score) };
                    } catch {
                        return { tokenId: inv.tokenId, score: 75 }; // default fallback
                    }
                })
            );

            const scoreMap = {};
            scores.forEach(({ tokenId, score }) => { scoreMap[tokenId] = score; });
            setBuyerScores(scoreMap);
        } catch (err) {
            console.error("Failed to fetch buyer scores:", err.message);
        }
    }

    async function refreshBalances() {
        if (!account) {
            setWalletAddress("");
            setWalletBalance("0");
            return;
        }
        try {
            // Use JsonRpcProvider (direct Ganache call) instead of BrowserProvider.
            // BrowserProvider delegates to MetaMask which caches the balance and
            // returns stale data after a Ganache restart — causing the mismatch.
            const directProvider = getReadOnlyProvider();
            const walletWei = await directProvider.getBalance(account);
            setWalletAddress(account);
            setWalletBalance(ethers.formatEther(walletWei));
        } catch (err) {
            console.error("Failed to refresh balance:", err);
        }
    }

    // ── ZK Phase-1: bulk-fetch privacy status for a list of invoices ─────────
    async function fetchZKData(invoiceList) {
        if (!invoiceList || invoiceList.length === 0) return;
        try {
            const contract = getReadOnlyContract();
            const PROOF_LABELS = ["None", "Generated", "Verified"];
            const results = await Promise.all(
                invoiceList.map(async (inv) => {
                    try {
                        const [zkEnabled, , proofStatusIndex] =
                            await contract.getZKMetadata(inv.tokenId);
                        return {
                            tokenId: inv.tokenId,
                            zkEnabled,
                            proofStatus: PROOF_LABELS[Number(proofStatusIndex)] ?? "None",
                        };
                    } catch {
                        return { tokenId: inv.tokenId, zkEnabled: false, proofStatus: "None" };
                    }
                })
            );
            const map = {};
            results.forEach(({ tokenId, zkEnabled, proofStatus }) => {
                map[tokenId] = { zkEnabled, proofStatus };
            });
            setZkData(map);
        } catch (err) {
            console.error("Failed to fetch ZK metadata:", err.message);
        }
    }

    // ── Financier Investment Analytics ──────────────────────────────────────
    async function fetchCreditProfile() {
        if (!account) return;
        setLoadingCredit(true);
        try {
            const contract = getReadOnlyContract();
            const raw = await contract.getCreditProfile(account);
            setCreditProfile({
                score:                    Number(raw.score),
                activeInvestments:        Number(raw.activeInvestments),
                completedInvestments:     Number(raw.completedInvestments),
                totalCapitalInvested:     ethers.formatEther(raw.totalCapitalInvested),
                totalInvestedInCompleted: ethers.formatEther(raw.totalInvestedInCompleted),
                totalCapitalRecovered:    ethers.formatEther(raw.totalCapitalRecovered),
            });
        } catch (err) {
            console.error("Failed to fetch investment analytics:", err.message);
        } finally {
            setLoadingCredit(false);
        }
    }

    useEffect(() => {
        fetchListedInvoices();
        refreshBalances();
        fetchCreditProfile();
    }, [account, provider]);

    // ── existing handler ────────────────────────────────────────────────────
    async function handleBuy() {
        if (!account) return setBuyMsg("Please connect your wallet.");
        if (!buyTokenId) return setBuyMsg("Please enter a Token ID.");

        // ── ZK Gate: private invoices must be VERIFIED before purchase ──
        const inv = invoices.find(i => i.tokenId === Number(buyTokenId));
        if (inv) {
            const zk = zkData[inv.tokenId];
            if (zk?.zkEnabled) {
                if (zk.proofStatus !== "Verified") {
                    return setBuyMsg("❌ This is a Private Invoice. Verify the ZK proof before purchasing.");
                }
            }
        }

        setBuying(true);
        setBuyMsg("");
        try {
            const invoice = invoices.find((item) => item.tokenId === Number(buyTokenId));
            if (!invoice) return setBuyMsg("❌ Unable to find the selected invoice.");

            const signer = await provider.getSigner();
            const signerAddress = await signer.getAddress();
            const signerContract = getSignerContract(signer);
            const priceWei = ethers.parseEther(invoice.currPrice);
            const readProvider = getReadOnlyProvider();

            console.log("Connected Account:", account);
            console.log("Signer Address:", signerAddress);

            const supplierBefore = await readProvider.getBalance(invoice.currentOwner);
            const financierBefore = await readProvider.getBalance(signerAddress);
            const contractBefore = await readProvider.getBalance(CONTRACT_ADDRESS);

            console.log("[buyInvoice] tokenId:", buyTokenId);
            console.log("[buyInvoice] invoice price (ETH):", invoice.currPrice);
            console.log("[buyInvoice] msg.value (wei):", priceWei.toString());
            console.log("[buyInvoice] supplier balance before:", ethers.formatEther(supplierBefore));
            console.log("[buyInvoice] financier balance before:", ethers.formatEther(financierBefore));
            console.log("[buyInvoice] contract balance before:", ethers.formatEther(contractBefore));

            const tx = await signerContract.buyInvoice(buyTokenId, { value: priceWei });
            console.log("Transaction Hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);

            const supplierAfter = await readProvider.getBalance(invoice.currentOwner);
            const financierAfter = await readProvider.getBalance(signerAddress);
            const contractAfter = await readProvider.getBalance(CONTRACT_ADDRESS);

            console.log("[buyInvoice] tx hash:", tx.hash);
            console.log("[buyInvoice] gas used:", receipt?.gasUsed?.toString?.() ?? "n/a");
            console.log("[buyInvoice] supplier balance after:", ethers.formatEther(supplierAfter));
            console.log("[buyInvoice] financier balance after:", ethers.formatEther(financierAfter));
            console.log("[buyInvoice] contract balance after:", ethers.formatEther(contractAfter));

            setBuyMsg(`✅ Invoice NFT purchased successfully! Tx: ${tx.hash}`);
            setBuyTokenId("");
            fetchListedInvoices();
            refreshBalances();
            fetchCreditProfile();   // NEW: refresh score after buying (+2 reward)
        } catch (err) {
            console.error("Buy transaction failed:", err);
            setBuyMsg(`❌ ${getFriendlyErrorMessage(err, "Purchase failed.")}`);
        } finally {
            setBuying(false);
        }
    }

    // ── ZK Phase-3: verify Groth16 proof for a private invoice ─────────────
    async function handleVerifyProof() {
        if (!account)         return setZkVerifyMsg("❌ Please connect your wallet.");
        if (!zkVerifyTokenId) return setZkVerifyMsg("❌ Enter the Token ID to verify.");

        setZkVerifying(true);
        setZkVerifyMsg("Step 1/2 — Running off-chain pre-flight check…");
        setZkVerifyResult(null);

        try {
            // ── Step 1: backend snarkjs verify (optional pre-flight only) ──────────
            let backendTimeMs = null;
            try {
                const res = await fetch(`${BACKEND_URL}/zk/verify`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ invoiceId: zkVerifyTokenId }),
                });
                const data = await res.json();
                if (data.success) backendTimeMs = data.verificationTimeMs;
                if (data.success && !data.verified) {
                    setZkVerifyMsg("❌ Off-chain pre-flight FAILED — proof is invalid.");
                    return;
                }
            } catch (preflight) {
                console.warn("[ZK preflight] Backend unavailable — proceeding to on-chain:", preflight.message);
            }

            setZkVerifyMsg("Step 2/2 — Submitting on-chain Groth16 verification (blockchain is the final authority)…");

            // ── Step 2: fetch calldata from backend helper ───────────────────────
            const cdRes  = await fetch(`${BACKEND_URL}/zk/calldata/${zkVerifyTokenId}`);
            const cdData = await cdRes.json();
            if (!cdData.success) throw new Error("Could not build on-chain calldata: " + cdData.message);

            // ── Step 3: call verifyAndFund() on InvoiceNFT (authoritative) ─────────
            const t0 = Date.now();
            const signer   = await provider.getSigner();
            const contract = getSignerContract(signer);

            const tx = await contract.verifyAndFund(
                BigInt(zkVerifyTokenId),
                cdData.pA,
                cdData.pB,
                cdData.pC,
                cdData.pubSignals
            );
            const receipt = await tx.wait();
            const onChainTimeMs = Date.now() - t0;

            setZkVerifyResult({
                verified:           true,
                verificationTimeMs: backendTimeMs ?? onChainTimeMs,
                onChainTimeMs,
                proofStatus:        "VERIFIED",
                txHash:             receipt.hash ?? tx.hash,
            });

            setZkVerifyMsg(
                `✅ VERIFIED on-chain (EVM pairing check passed)! Tx: ${(receipt.hash ?? tx.hash).slice(0, 12)}…  Funding is now unlocked.`
            );
            setBuyTokenId(zkVerifyTokenId);
            fetchZKData(invoices);

        } catch (err) {
            console.error("[ZK verifyAndFund] Error:", err);
            setZkVerifyResult({ verified: false, proofStatus: "FAILED" });
            setZkVerifyMsg(`❌ ${getFriendlyErrorMessage(err, "On-chain proof verification failed.")}`);
        } finally {
            setZkVerifying(false);
        }
    }

    if (!account) {
        return (
            <div className="page">
                <h1>Financier Dashboard</h1>
                <div className="section-card">
                    <p>Please connect your wallet to continue.</p>
                </div>
            </div>
        );
    }

    if (roles?.financier && account.toLowerCase() !== roles.financier) {
        return (
            <div className="page">
                <h1>Financier Dashboard</h1>
                <div className="section-card">
                    <p>Please switch MetaMask to the Financier account.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <h1>Financier Dashboard</h1>
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

            {/* ── Investment Analytics ────────────────────────────────────────── */}
            <section className="section-card">
                <h2>
                    Investment Analytics&nbsp;
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
                    const invested    = parseFloat(creditProfile.totalInvestedInCompleted);
                    const recovered   = parseFloat(creditProfile.totalCapitalRecovered);
                    const roi = invested > 0
                        ? (((recovered - invested) / invested) * 100).toFixed(2)
                        : null;
                    return (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            gap: "16px 24px",
                            marginTop: "12px",
                        }}>
                            <div>
                                <span className="balance-label">Total Capital Deployed</span><br />
                                <strong>{creditProfile.totalCapitalInvested} ETH</strong>
                            </div>
                            <div>
                                <span className="balance-label">Active Investments</span><br />
                                <strong>{creditProfile.activeInvestments}</strong>
                            </div>
                            <div>
                                <span className="balance-label">Completed Investments</span><br />
                                <strong>{creditProfile.completedInvestments}</strong>
                            </div>
                            <div>
                                <span className="balance-label">Capital Recovered</span><br />
                                <strong>{creditProfile.totalCapitalRecovered} ETH</strong>
                            </div>
                            <div>
                                <span className="balance-label">Average ROI (closed positions)</span><br />
                                <strong style={{ color: roi === null ? "inherit" : roi >= 0 ? "#22c55e" : "#ef4444" }}>
                                    {roi === null ? "—" : `${roi}%`}
                                </strong>
                            </div>
                        </div>
                    );
                })() : (
                    <p style={{ marginTop: "12px" }}>
                        {loadingCredit ? "Loading analytics…" : "No investment activity yet."}
                    </p>
                )}
            </section>

            {/* ── Listed Invoices — NEW: Buyer Score column ────────────────── */}
            <section className="section-card">
                <h2>Listed Invoices</h2>
                <button className="btn btn-secondary" onClick={fetchListedInvoices}>
                    Refresh
                </button>
                {loadingInvoices ? (
                    <p>Loading...</p>
                ) : invoices.length === 0 ? (
                    <p style={{ marginTop: "12px" }}>No invoices currently listed for sale.</p>
                ) : (
                    <>
                        {/* Legend */}
                        <p style={{
                            marginTop: "10px", marginBottom: "4px",
                            fontSize: "0.78rem", color: "#6b7280",
                        }}>
                            💡 Buyer Score reflects the buyer's on-chain credit profile.
                            A higher score means lower default risk.
                        </p>
                        <table className="invoice-table">
                            <thead>
                                <tr>
                                    <th>Token ID</th>
                                    <th>Invoice Amount</th>
                                    <th>Current Price</th>
                                    <th>Due Date</th>
                                    <th>Buyer Score</th>
                                    <th>Privacy</th>
                                    <th>Proof Status</th>
                                    <th>Owner</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.tokenId}>
                                        <td>{inv.tokenId}</td>
                                        <td>{inv.invoiceAmount === null ? "🔒 Private" : `${inv.invoiceAmount} ETH`}</td>
                                        <td>{inv.currPrice} ETH</td>
                                        <td>{inv.dueDate}</td>
                                        <td>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                                <ScoreBadge score={buyerScores[inv.tokenId] ?? null} />
                                                {buyerScores[inv.tokenId] != null && (
                                                    <span style={{
                                                        fontSize: "0.65rem",
                                                        color: scoreColour(buyerScores[inv.tokenId]),
                                                    }}>
                                                        {scoreLabel(buyerScores[inv.tokenId])}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* ZK Phase 1 columns */}
                                        <td>
                                            {zkData[inv.tokenId]?.zkEnabled
                                                ? <span className="badge badge-blue" title="Groth16 ZK enabled">🔒 Private</span>
                                                : <span className="badge badge-grey">Public</span>}
                                        </td>
                                        <td>
                                            {(() => {
                                                const status = zkData[inv.tokenId]?.proofStatus ?? "None";
                                                const colour = status === "Verified" ? "badge-green"
                                                             : status === "Generated" ? "badge-blue"
                                                             : "badge-grey";
                                                return <span className={`badge ${colour}`}>{status}</span>;
                                            })()}
                                        </td>
                                        <td>
                                            {inv.currentOwner.slice(0, 6)}...{inv.currentOwner.slice(-4)}
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
                    </>
                )}
            </section>

            {/* ── ZK Phase-3: Verify Proof section ───────────────────────── */}
            <section className="section-card">
                <h2>🔒 Private Invoice — Verify Proof</h2>
                <p style={{ marginBottom: "12px", fontSize: "0.85rem", color: "#6b7280" }}>
                    Verify the Groth16 zero-knowledge proof for a private invoice.
                    Funding is only permitted after successful verification.
                </p>
                <div className="form-group">
                    <label>Token ID (Private Invoice)</label>
                    <input type="number" value={zkVerifyTokenId}
                        onChange={e => setZkVerifyTokenId(e.target.value)}
                        placeholder="Token ID" className="form-input" />
                </div>
                <button className="btn btn-primary"
                    onClick={handleVerifyProof}
                    disabled={zkVerifying}
                    style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                    {zkVerifying ? "Verifying Proof…" : "Verify Proof"}
                </button>
                {zkVerifyMsg && <p className="form-msg">{zkVerifyMsg}</p>}
                {zkVerifyResult && (
                    <div style={{
                        marginTop: "14px", padding: "12px 16px",
                        background: zkVerifyResult.verified ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                        border: `1px solid ${zkVerifyResult.verified ? "#86efac" : "#fca5a5"}`,
                        borderRadius: "8px", fontSize: "0.82rem",
                    }}>
                        <div><span className="balance-label">Proof Status</span><br />
                            <strong style={{ color: zkVerifyResult.verified ? "#22c55e" : "#ef4444" }}>
                                {zkVerifyResult.verified ? "✅ VERIFIED" : "❌ FAILED"}
                            </strong></div>
                        <div style={{ marginTop: "8px" }}><span className="balance-label">Verification Time</span><br />
                            <strong>{zkVerifyResult.verificationTimeMs} ms</strong></div>
                        {zkVerifyResult.verified && (
                            <p style={{ marginTop: "8px", color: "#15803d", fontWeight: 600 }}>
                                Funding is now unlocked for this invoice.
                            </p>
                        )}
                    </div>
                )}
            </section>

            {/* ── Buy Invoice (unchanged) ───────────────────────────────────── */}
            <section className="section-card">
                <h2>Buy Invoice NFT</h2>
                <p style={{ marginBottom: "12px", color: "#4a4a4a" }}>
                    Purchase a discounted invoice NFT. You will pay the current listed price.
                    <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "#22c55e" }}>
                        (+2 credit score on purchase)
                    </span>
                </p>
                <div className="form-group">
                    <label>Token ID</label>
                    <input
                        type="number"
                        value={buyTokenId}
                        onChange={(e) => setBuyTokenId(e.target.value)}
                        placeholder="0"
                        className="form-input"
                    />
                </div>

                {/* Preview: show buyer score for the token being considered */}
                {buyTokenId !== "" && invoices.find((i) => i.tokenId === Number(buyTokenId)) && (
                    <div style={{
                        padding: "10px 14px", marginBottom: "10px",
                        background: "rgba(0,0,0,0.03)", borderRadius: "6px",
                        fontSize: "0.82rem",
                    }}>
                        {(() => {
                            const inv = invoices.find((i) => i.tokenId === Number(buyTokenId));
                            const score = buyerScores[inv.tokenId];
                            return score != null ? (
                                <span>
                                    Buyer credit score for Token {buyTokenId}:&nbsp;
                                    <strong style={{ color: scoreColour(score) }}>
                                        {score} — {scoreLabel(score)}
                                    </strong>
                                </span>
                            ) : (
                                <span style={{ color: "#9ca3af" }}>Fetching buyer score…</span>
                            );
                        })()}
                    </div>
                )}

                <button className="btn btn-primary" onClick={handleBuy} disabled={buying}>
                    {buying ? "Buying..." : "Buy Invoice NFT"}
                </button>
                {buyMsg && <p className="form-msg">{buyMsg}</p>}
            </section>
        </div>
    );
}

export default FinancierDashboard;