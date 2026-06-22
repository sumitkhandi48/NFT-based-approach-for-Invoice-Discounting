import { Link } from "react-router-dom";

function Home() {
    return (
        <div className="page">
            <div className="hero">
                <h1>NFT-Based Invoice Discounting</h1>
                <p className="subtitle">
                    A decentralized platform that tokenizes trade invoices as NFTs,
                    enabling suppliers, buyers, and financiers to securely manage
                    invoice discounting on the blockchain.
                </p>
                <button className="btn btn-primary">Connect Wallet</button>
            </div>

            <div className="info-grid">
                <div className="info-card">
                    <h3>For Suppliers</h3>
                    <p>Mint invoices as NFTs and list them for discounting.</p>
                </div>
                <div className="info-card">
                    <h3>For Buyers</h3>
                    <p>Sign and settle invoices on their due date.</p>
                </div>
                <div className="info-card">
                    <h3>For Financiers</h3>
                    <p>Browse the marketplace and purchase discounted invoices.</p>
                </div>
            </div>

            <div className="nav-links">
                <Link to="/dashboard" className="btn btn-secondary">
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}

export default Home;