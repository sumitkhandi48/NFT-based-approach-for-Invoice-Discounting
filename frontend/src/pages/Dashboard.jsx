function Dashboard() {
    return (
        <div className="page">
            <h1>Dashboard</h1>

            <div className="wallet-info">
                <p>
                    <strong>Wallet Address:</strong> Not connected
                </p>
                <p>
                    <strong>Network:</strong> Not connected
                </p>
            </div>

            <h2>Quick Actions</h2>
            <div className="role-grid">
                <div className="role-card">
                    <h3>Supplier</h3>
                    <p>Upload, mint, and manage your invoices</p>
                </div>
                <div className="role-card">
                    <h3>Buyer</h3>
                    <p>Sign and settle assigned invoices</p>
                </div>
                <div className="role-card">
                    <h3>Financier</h3>
                    <p>Browse and buy listed invoices</p>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;