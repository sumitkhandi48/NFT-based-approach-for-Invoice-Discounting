import Navbar from "./Navbar.jsx";

function Layout({ children }) {
    return (
        <div className="app-container">
            <Navbar />
            <main className="main-content">{children}</main>
            <footer className="footer">
                <p>NFT-Based Invoice Discounting &mdash; Academic Project</p>
            </footer>
        </div>
    );
}

export default Layout;