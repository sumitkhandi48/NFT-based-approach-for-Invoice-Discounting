import Navbar from "./Navbar.jsx";
import BackButton from "./BackButton.jsx";

function Layout({ children }) {
    return (
        <div className="app-container">
            <Navbar />
            <div className="layout-actions">
                <BackButton />
            </div>
            <main className="main-content">{children}</main>
            <footer className="footer">
                <p>NFT-Based Invoice Discounting &mdash; Academic Project</p>
            </footer>
        </div>
    );
}

export default Layout;