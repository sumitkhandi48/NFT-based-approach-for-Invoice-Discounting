import { network } from "hardhat";

async function main() {
    console.log("Deploying InvoiceNFT to Ganache...\n");

    const connection = await network.connect("ganache");
    const ethers = connection.ethers;

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    const invoiceNFT = await InvoiceNFT.deploy();
    await invoiceNFT.waitForDeployment();

    const contractAddress = await invoiceNFT.getAddress();
    console.log("InvoiceNFT deployed to:", contractAddress);
    console.log("\nSave this address — backend ke liye chahiye.\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });