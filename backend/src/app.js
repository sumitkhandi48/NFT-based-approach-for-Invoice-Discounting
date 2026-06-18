import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.json({ status: "Invoice Discounting Backend is running" });
});

export default app;