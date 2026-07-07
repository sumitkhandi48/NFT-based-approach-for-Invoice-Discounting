import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

function FinancierDashboard() {
    const { account, provider } = useWallet();
    const { getSignerContract, getReadOnlyProvider, CONTRACT_ADDRESS } = useContract();

    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [buyTokenId, setBuyTokenId] = useState("");
    const [buying, setBuying] = useState(false);
    const [buyMsg, setBuyMsg] = useState("");

    const [walletAddress, setWalletAddress] = useState("");
    const [walletBalance, setWalletBalance] = useState("0");

    async function fetchListedInvoices() {
        setLoadingInvoices(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/summary`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch invoices.");
            }

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
        } catch (err) {
            console.error("Failed to fetch listed invoices:", err.message);
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
        fetchListedInvoices();
        refreshBalances();
    }, [account, provider]);

    async function handleBuy() {
        if (!account) return setBuyMsg("Please connect your wallet.");
        if (!buyTokenId) return setBuyMsg("Please enter a Token ID.");

        setBuying(true);
        setBuyMsg("");
        try {
            const invoice = invoices.find((item) => item.tokenId === Number(buyTokenId));
            if (!invoice) {
                return setBuyMsg("❌ Unable to find the selected invoice.");
            }

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
            console.log("Waiting for confirmation...");
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
        } catch (err) {
            console.error("Buy transaction failed:", err);
            setBuyMsg(`❌ ${getFriendlyErrorMessage(err, "Purchase failed.")}`);
        } finally {
            setBuying(false);
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

    return (
        <div className="page">
            <h1>Financier Dashboard</h1>
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
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Token ID</th>
                                <th>Invoice Amount</th>
                                <th>Current Price</th>
                                <th>Due Date</th>
                                <th>Owner</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((inv) => (
                                <tr key={inv.tokenId}>
                                    <td>{inv.tokenId}</td>
                                    <td>{inv.invoiceAmount} ETH</td>
                                    <td>{inv.currPrice} ETH</td>
                                    <td>{inv.dueDate}</td>
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
                )}
            </section>

            <section className="section-card">
                <h2>Buy Invoice NFT</h2>
                <p style={{ marginBottom: "12px", color: "#4a4a4a" }}>
                    Purchase a discounted invoice NFT. You will pay the current listed price.
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
                <button className="btn btn-primary" onClick={handleBuy} disabled={buying}>
                    {buying ? "Buying..." : "Buy Invoice NFT"}
                </button>
                {buyMsg && <p className="form-msg">{buyMsg}</p>}
            </section>
        </div>
    );
}

export default FinancierDashboard;