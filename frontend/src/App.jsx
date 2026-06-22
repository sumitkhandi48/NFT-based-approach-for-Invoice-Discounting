import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import SupplierDashboard from "./pages/SupplierDashboard.jsx";
import BuyerDashboard from "./pages/BuyerDashboard.jsx";
import FinancierDashboard from "./pages/FinancierDashboard.jsx";
import InvoiceDetails from "./pages/InvoiceDetails.jsx";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/supplier" element={<SupplierDashboard />} />
        <Route path="/buyer" element={<BuyerDashboard />} />
        <Route path="/financier" element={<FinancierDashboard />} />
        <Route path="/invoice/:tokenId" element={<InvoiceDetails />} />
      </Routes>
    </Layout>
  );
}

export default App;