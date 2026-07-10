import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useContract } from "../context/ContractContext.jsx";
import { getFriendlyErrorMessage } from "../utils/errorMessage.js";

const BACKEND_URL = "http://localhost:3000";

function SupplierDashboard() {
    const { account, provider } = useWallet();
    const { getSignerContract } = useContract();

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

    async function fetchInvoices() {
        if (!account) return;
        setLoadingInvoices(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/invoices/summary`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch invoices.");
            }

            const results = (data.invoices || [])
                .filter((invoice) => invoice.creator.toLowerCase() === account.toLowerCase())
                .map((invoice) => ({
                    tokenId: invoice.tokenId,
                    buyer: invoice.buyer,
                    invoiceAmount: invoice.invoiceAmount,
                    currPrice: invoice.currPrice,
                    dueDate: invoice.dueDate,
                    isApproved: invoice.isApproved,
                    forSale: invoice.forSale,
                    currentOwner: invoice.currentOwner,
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
        fetchInvoices();
        refreshBalances();
    }, [account, provider]);

    async function handleUpload() {
        if (!file) return setUploadMsg("Please select a file.");
        setUploading(true);
        setUploadMsg("");
        try {
            const formData = new FormData();
            formData.append("invoice", file);
            const res = await fetch(`${BACKEND_URL}/api/invoices/upload`, {
                method: "POST",
                body: formData,
            });
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
            console.log("Transaction Hash:", tx.hash);
            console.log("Waiting for confirmation...");
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);
            setMintMsg(`✅ Invoice NFT minted successfully! Tx: ${tx.hash}`);
            setMintBuyer("");
            setMintAmount("");
            setMintDueDate("");
            setCid("");
            setFile(null);
            fetchInvoices();
            refreshBalances();
        } catch (err) {
            console.error("Mint transaction failed:", err);
            setMintMsg(`❌ ${getFriendlyErrorMessage(err, "Minting failed.")}`);
        } finally {
            setMinting(false);
        }
    }

    async function handleList() {
        if (!account) return setListMsg("Please connect your wallet.");
        if (!listTokenId || !listPrice) return setListMsg("Please fill all fields.");

        setListing(true);
        setListMsg("");
        try {
            const signer = await provider.getSigner();
            const contract = getSignerContract(signer);
            const priceWei = ethers.parseEther(listPrice);
            const tx = await contract.approveInvoiceSale(listTokenId, priceWei);
            console.log("Transaction Hash:", tx.hash);
            console.log("Waiting for confirmation...");
            const receipt = await tx.wait();
            console.log("Confirmed in block:", receipt.blockNumber);
            setListMsg(`✅ Invoice listed for sale! Tx: ${tx.hash}`);
            setListTokenId("");
            setListPrice("");
            fetchInvoices();
            refreshBalances();
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
            console.log("Transaction Hash:", tx.hash);
            console.log("Waiting for confirmation...");
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

    return (
        <div className="page">
            <h1>Supplier Dashboard</h1>
            <p className="subtitle-small">Connected: {account}</p>

            <section className="section-card balance-card">
                <h2>Live Balances</h2>
                <div className="balance-grid">
                    <div className="balance-item">
                        <span className="balance-label">Wallet</span>
                        <strong>{walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}</strong>
                    </div>
                    <div className="balance-item">
                        <span className="balance-label">Wallet Balance</span>
                        <strong>{walletBalance} ETH</strong>
                    </div>
                </div>
            </section>

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

            <section className="section-card">
                <h2>Step 2 — Mint Invoice NFT</h2>
                <div className="form-group">
                    <label>CID (auto-filled after upload)</label>
                    <input
                        type="text"
                        value={cid}
                        onChange={(e) => setCid(e.target.value)}
                        placeholder="Qm... or bafk..."
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Buyer Address</label>
                    <input
                        type="text"
                        value={mintBuyer}
                        onChange={(e) => setMintBuyer(e.target.value)}
                        placeholder="0x..."
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Invoice Amount (ETH)</label>
                    <input
                        type="number"
                        value={mintAmount}
                        onChange={(e) => setMintAmount(e.target.value)}
                        placeholder="1.0"
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Due Date (DD-MM-YYYY)</label>
                    <input
                        type="text"
                        value={mintDueDate}
                        onChange={(e) => setMintDueDate(e.target.value)}
                        placeholder="31-12-2025"
                        className="form-input"
                    />
                </div>
                <button className="btn btn-primary" onClick={handleMint} disabled={minting}>
                    {minting ? "Minting..." : "Mint Invoice NFT"}
                </button>
                {mintMsg && <p className="form-msg">{mintMsg}</p>}
            </section>

            <section className="section-card">
                <h2>Your Invoices</h2>
                <button className="btn btn-secondary" onClick={fetchInvoices}>
                    Refresh
                </button>
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
                <h2>List Invoice for Sale</h2>
                <div className="form-group">
                    <label>Token ID</label>
                    <input
                        type="number"
                        value={listTokenId}
                        onChange={(e) => setListTokenId(e.target.value)}
                        placeholder="0"
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Discounted Price (ETH)</label>
                    <input
                        type="number"
                        value={listPrice}
                        onChange={(e) => setListPrice(e.target.value)}
                        placeholder="0.8"
                        className="form-input"
                    />
                </div>
                <button className="btn btn-primary" onClick={handleList} disabled={listing}>
                    {listing ? "Listing..." : "List for Sale"}
                </button>
                {listMsg && <p className="form-msg">{listMsg}</p>}
            </section>

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