function FinancierDashboard() {
    return (
        <div className="page">
            <h1>Financier Dashboard</h1>

            <section className="section-card">
                <h2>Listed Invoices</h2>
                <p>No invoices currently listed for sale.</p>
            </section>

            <section className="section-card">
                <h2>Buy Invoice NFT</h2>
                <p>Purchase a discounted invoice NFT from the marketplace.</p>
                <button className="btn btn-primary">Buy Invoice</button>
            </section>
        </div>
    );
}

export default FinancierDashboard;