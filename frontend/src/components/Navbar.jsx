import { Link } from "react-router-dom";

function Navbar() {
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
        </nav>
    );
}

export default Navbar;