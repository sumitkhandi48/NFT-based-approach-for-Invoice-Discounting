function SupplierDashboard() {
    return (
        <div className="page">
            <h1>Supplier Dashboard</h1>

            <section className="section-card">
                <h2>Upload Invoice</h2>
                <p>Upload an invoice document to IPFS.</p>
                <button className="btn btn-primary">Upload Invoice</button>
            </section>

            <section className="section-card">
                <h2>Mint Invoice NFT</h2>
                <p>Mint a new invoice NFT after uploading.</p>
                <button className="btn btn-primary">Mint Invoice</button>
            </section>

            <section className="section-card">
                <h2>Your Invoices</h2>
                <p>No invoices to display yet.</p>
            </section>

            <section className="section-card">
                <h2>List Invoice for Sale</h2>
                <p>List a signed invoice for discounting.</p>
                <button className="btn btn-secondary">List Invoice</button>
            </section>

            <section className="section-card">
                <h2>Revoke Listing</h2>
                <p>Remove an invoice from the marketplace.</p>
                <button className="btn btn-secondary">Revoke Listing</button>
            </section>
        </div>
    );
}

export default SupplierDashboard;