import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";

function Dashboard() {
    const { account, network, connectWallet } = useWallet();

    return (
        <div className="page">
            <h1>Dashboard</h1>

            <div className="wallet-info">
                {account ? (
                    <>
                        <p>
                            <strong>Wallet Address:</strong> {account}
                        </p>
                        <p>
                            <strong>Network:</strong> {network}
                        </p>
                    </>
                ) : (
                    <>
                        <p>
                            <strong>Wallet Address:</strong> Not connected
                        </p>
                        <p>
                            <strong>Network:</strong> Not connected
                        </p>
                        <button className="btn btn-primary" onClick={connectWallet}>
                            Connect Wallet
                        </button>
                    </>
                )}
            </div>

            <h2>Select Your Role</h2>
            <div className="role-grid">
                <Link to="/supplier" className="role-card">
                    <h3>Supplier</h3>
                    <p>Upload, mint, and manage your invoices</p>
                </Link>
                <Link to="/buyer" className="role-card">
                    <h3>Buyer</h3>
                    <p>Sign and settle assigned invoices</p>
                </Link>
                <Link to="/financier" className="role-card">
                    <h3>Financier</h3>
                    <p>Browse and buy listed invoices</p>
                </Link>
            </div>
        </div>
    );
}

export default Dashboard;