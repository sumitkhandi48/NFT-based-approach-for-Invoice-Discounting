import { useParams } from "react-router-dom";

function InvoiceDetails() {
    const { tokenId } = useParams();

    return (
        <div className="page">
            <h1>Invoice Details</h1>
            <p className="subtitle-small">Token ID: {tokenId}</p>

            <section className="section-card">
                <table className="details-table">
                    <tbody>
                        <tr>
                            <td>Token ID</td>
                            <td>{tokenId}</td>
                        </tr>
                        <tr>
                            <td>CID</td>
                            <td>—</td>
                        </tr>
                        <tr>
                            <td>Invoice Amount</td>
                            <td>—</td>
                        </tr>
                        <tr>
                            <td>Due Date</td>
                            <td>—</td>
                        </tr>
                        <tr>
                            <td>Owner</td>
                            <td>—</td>
                        </tr>
                        <tr>
                            <td>Buyer</td>
                            <td>—</td>
                        </tr>
                        <tr>
                            <td>Approved Status</td>
                            <td>—</td>
                        </tr>
                        <tr>
                            <td>For Sale Status</td>
                            <td>—</td>
                        </tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
}

export default InvoiceDetails;