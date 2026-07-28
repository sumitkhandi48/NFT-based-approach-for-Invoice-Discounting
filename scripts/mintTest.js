import { network } from "hardhat";
import { readFileSync } from "fs";

async function main() {
  const connection = await network.getOrCreate("ganache");
  const ethers = connection.ethers;

  const [supplier, buyer] = await ethers.getSigners();

  const contract = await ethers.getContractAt(
    "InvoiceNFT",
    "0xe3c505901332ac488B29fC8dAe2427B5A9cd4f9a"
  );

  const tx = await contract.connect(supplier).mintInvoice(
    "QmTestCID123",
    buyer.address,
    ethers.parseEther("1.0"),
    "31-12-2025"
  );
  await tx.wait();
  console.log("Minted tokenId 0 successfully");
}

main().catch(console.error);
