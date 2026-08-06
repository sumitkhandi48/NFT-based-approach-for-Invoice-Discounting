import { network } from "hardhat";

async function main() {
    const connection = await network.getOrCreate("ganache");
    const ethers = connection.ethers;
    const signers = await ethers.getSigners();
    console.log("supplier:", signers[0].address);
    console.log("buyer:", signers[1].address);
    console.log("financier:", signers[2].address);
    console.log("other:", signers[3].address);
}

main().catch(console.error);
