import express from "express";
import cors from "cors";
import invoiceRoutes from "./routes/invoiceRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/invoices", invoiceRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({ status: "Invoice Discounting Backend is running" });
});

export default app;