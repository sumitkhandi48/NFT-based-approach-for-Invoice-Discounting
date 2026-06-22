import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";

function Navbar() {
    const { account, connectWallet, disconnectWallet } = useWallet();

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Invoice Discounting DApp</Link>
            </div>
            <div className="navbar-links">
                <Link to="/">Home</Link>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/supplier">Supplier</Link>
                <Link to="/buyer">Buyer</Link>
                <Link to="/financier">Financier</Link>
            </div>
            <div className="navbar-wallet">
                {account ? (
                    <div className="wallet-connected">
                        <span className="wallet-address">
                            {account.slice(0, 6)}...{account.slice(-4)}
                        </span>
                        <button className="btn btn-disconnect" onClick={disconnectWallet}>
                            Disconnect
                        </button>
                    </div>
                ) : (
                    <button className="btn btn-connect" onClick={connectWallet}>
                        Connect Wallet
                    </button>
                )}
            </div>
        </nav>
    );
}

export default Navbar;