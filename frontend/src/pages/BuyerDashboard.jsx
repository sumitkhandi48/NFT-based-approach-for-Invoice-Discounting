function BuyerDashboard() {
    return (
        <div className="page">
            <h1>Buyer Dashboard</h1>

            <section className="section-card">
                <h2>Assigned Invoices</h2>
                <p>No invoices assigned to you yet.</p>
            </section>

            <section className="section-card">
                <h2>Sign Invoice</h2>
                <p>Approve an invoice assigned to you by the supplier.</p>
                <button className="btn btn-primary">Sign Invoice</button>
            </section>

            <section className="section-card">
                <h2>Settle Invoice</h2>
                <p>Settle an invoice on or after its due date.</p>
                <button className="btn btn-primary">Settle Invoice</button>
            </section>
        </div>
    );
}

export default BuyerDashboard;