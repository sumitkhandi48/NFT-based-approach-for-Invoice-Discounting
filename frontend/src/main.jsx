import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext.jsx";
import { ContractProvider } from "./context/ContractContext.jsx";
import App from "./App.jsx";
import "./styles/App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <ContractProvider>
          <App />
        </ContractProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);