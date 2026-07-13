import { network } from "hardhat";

async function main() {
    const activeNetwork = process.env.NETWORK;

    console.log(`Deploying to ${activeNetwork}...\n`);

    const connection = await network.connect(activeNetwork);
    const ethers = connection.ethers;

    const [deployer] = await ethers.getSigners();

    console.log("Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");

    const invoiceNFT = await InvoiceNFT.deploy();
    await invoiceNFT.waitForDeployment();

    console.log("Contract:", await invoiceNFT.getAddress());
}

main().catch(console.error);