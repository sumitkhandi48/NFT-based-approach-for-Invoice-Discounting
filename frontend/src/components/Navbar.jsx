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
            </div>
        </nav>
    );
}

export default Navbar;