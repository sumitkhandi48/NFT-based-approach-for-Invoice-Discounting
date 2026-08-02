import express from "express";
import cors from "cors";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import zkRoutes from "./routes/zkRoutes.js";
import { renderDashboard } from "./controllers/dashboardController.js";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/invoices", invoiceRoutes);
app.use("/zk", zkRoutes);               // Phase 1 ZK placeholder endpoints

// Backend dashboard
app.get("/", renderDashboard);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "Invoice Discounting Backend is running" });
});

export default app;