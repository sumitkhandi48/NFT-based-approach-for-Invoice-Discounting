import express from "express";
import cors from "cors";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import { renderDashboard } from "./controllers/dashboardController.js";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/invoices", invoiceRoutes);

// Backend dashboard
app.get("/", renderDashboard);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "Invoice Discounting Backend is running" });
});

export default app;