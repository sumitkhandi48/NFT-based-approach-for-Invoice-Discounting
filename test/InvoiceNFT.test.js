import { network } from "hardhat";
import { expect } from "chai";

describe("InvoiceNFT", function () {
    let invoiceNFT;
    let ethers;
    let supplier, buyer, financier, other;

    let invoiceAmount;
    let discountedPrice;

    const CID_1 = "QmTestCID1234567890abcdef";
    const CID_2 = "QmTestCID0987654321fedcba";
    const dueDate = "31-12-2025";

    beforeEach(async function () {
        const connection = await network.getOrCreate("ganache");
        ethers = connection.ethers;

        invoiceAmount = ethers.parseEther("1.0");
        discountedPrice = ethers.parseEther("0.8");

        [supplier, buyer, financier, other] = await ethers.getSigners();

        const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
        invoiceNFT = await InvoiceNFT.deploy();
        await invoiceNFT.waitForDeployment();
    });

    // ─────────────────────────────────────────────
    // Algorithm 1 — mintInvoice()
    // ─────────────────────────────────────────────
    describe("Algorithm 1 — mintInvoice()", function () {

        it("should mint a new invoice NFT successfully", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);

            const metadata = await invoiceNFT.InvoiceNFT_Map(0);
            expect(metadata.creator).to.equal(supplier.address);
            expect(metadata.buyer).to.equal(buyer.address);
            expect(metadata.invoiceAmount).to.equal(invoiceAmount);
            expect(metadata.currPrice).to.equal(invoiceAmount);
            expect(metadata.dueDate).to.equal(dueDate);
            expect(metadata.isApproved).to.equal(false);
            expect(metadata.forSale).to.equal(false);
        });

        it("should set tokenURI to the CID", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);

            const tokenURI = await invoiceNFT.tokenURI(0);
            expect(tokenURI).to.equal(CID_1);
        });

        it("should revert if supplier and buyer are the same address", async function () {
            await expect(
                invoiceNFT
                    .connect(supplier)
                    .mintInvoice(CID_1, supplier.address, invoiceAmount, dueDate)
            ).to.be.rejected;
        });

        it("should revert if CID already exists (duplicate invoice)", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);

            await expect(
                invoiceNFT
                    .connect(supplier)
                    .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate)
            ).to.be.rejected;
        });

        it("should allow minting two invoices with different CIDs", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_2, buyer.address, invoiceAmount, dueDate);

            expect(await invoiceNFT.ownerOf(0)).to.equal(supplier.address);
            expect(await invoiceNFT.ownerOf(1)).to.equal(supplier.address);
        });
    });

    // ─────────────────────────────────────────────
    // Algorithm 2 — signInvoice()
    // ─────────────────────────────────────────────
    describe("Algorithm 2 — signInvoice()", function () {

        beforeEach(async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
        });

        it("should allow the correct buyer to sign", async function () {
            await invoiceNFT.connect(buyer).signInvoice(0);
            const metadata = await invoiceNFT.InvoiceNFT_Map(0);
            expect(metadata.isApproved).to.equal(true);
        });

        it("should revert if a non-buyer tries to sign", async function () {
            await expect(
                invoiceNFT.connect(other).signInvoice(0)
            ).to.be.rejected;
        });

        it("should revert if invoice is already signed", async function () {
            await invoiceNFT.connect(buyer).signInvoice(0);
            await expect(
                invoiceNFT.connect(buyer).signInvoice(0)
            ).to.be.rejected;
        });
    });

    // ─────────────────────────────────────────────
    // Algorithm 3 — approveInvoiceSale()
    // ─────────────────────────────────────────────
    describe("Algorithm 3 — approveInvoiceSale()", function () {

        beforeEach(async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
            await invoiceNFT.connect(buyer).signInvoice(0);
        });

        it("should list NFT for sale with discounted price", async function () {
            await invoiceNFT
                .connect(supplier)
                .approveInvoiceSale(0, discountedPrice);

            const metadata = await invoiceNFT.InvoiceNFT_Map(0);
            expect(metadata.forSale).to.equal(true);
            expect(metadata.currPrice).to.equal(discountedPrice);
        });

        it("should revert if invoice is not yet signed by buyer", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_2, buyer.address, invoiceAmount, dueDate);

            await expect(
                invoiceNFT.connect(supplier).approveInvoiceSale(1, discountedPrice)
            ).to.be.rejected;
        });

        it("should revert if caller is not the NFT owner", async function () {
            await expect(
                invoiceNFT.connect(other).approveInvoiceSale(0, discountedPrice)
            ).to.be.rejected;
        });

        it("should revert if NFT is already listed for sale", async function () {
            await invoiceNFT
                .connect(supplier)
                .approveInvoiceSale(0, discountedPrice);

            await expect(
                invoiceNFT.connect(supplier).approveInvoiceSale(0, discountedPrice)
            ).to.be.rejected;
        });
    });

    // ─────────────────────────────────────────────
    // Algorithm 4 — revokeInvoiceSale()
    // ─────────────────────────────────────────────
    describe("Algorithm 4 — revokeInvoiceSale()", function () {

        beforeEach(async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
            await invoiceNFT.connect(buyer).signInvoice(0);
            await invoiceNFT
                .connect(supplier)
                .approveInvoiceSale(0, discountedPrice);
        });

        it("should delist NFT and reset currPrice to invoiceAmount", async function () {
            await invoiceNFT.connect(supplier).revokeInvoiceSale(0);

            const metadata = await invoiceNFT.InvoiceNFT_Map(0);
            expect(metadata.forSale).to.equal(false);
            expect(metadata.currPrice).to.equal(invoiceAmount);
        });

        it("should revert if caller is not the NFT owner", async function () {
            await expect(
                invoiceNFT.connect(other).revokeInvoiceSale(0)
            ).to.be.rejected;
        });

        it("should revert if NFT is not currently listed for sale", async function () {
            await invoiceNFT.connect(supplier).revokeInvoiceSale(0);

            await expect(
                invoiceNFT.connect(supplier).revokeInvoiceSale(0)
            ).to.be.rejected;
        });
    });

    // ─────────────────────────────────────────────
    // Algorithm 5 — buyInvoice()
    // ─────────────────────────────────────────────
    describe("Algorithm 5 — buyInvoice()", function () {

        beforeEach(async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
            await invoiceNFT.connect(buyer).signInvoice(0);
            await invoiceNFT
                .connect(supplier)
                .approveInvoiceSale(0, discountedPrice);
        });

        it("should transfer NFT to financier and ETH to supplier", async function () {
            const supplierBalanceBefore = await ethers.provider.getBalance(
                supplier.address
            );

            await invoiceNFT
                .connect(financier)
                .buyInvoice(0, { value: discountedPrice });

            expect(await invoiceNFT.ownerOf(0)).to.equal(financier.address);

            const supplierBalanceAfter = await ethers.provider.getBalance(
                supplier.address
            );
            expect(supplierBalanceAfter).to.be.gt(supplierBalanceBefore);
        });

        it("should reset forSale to false and currPrice to invoiceAmount", async function () {
            await invoiceNFT
                .connect(financier)
                .buyInvoice(0, { value: discountedPrice });

            const metadata = await invoiceNFT.InvoiceNFT_Map(0);
            expect(metadata.forSale).to.equal(false);
            expect(metadata.currPrice).to.equal(invoiceAmount);
        });

        it("should revert if NFT is not listed for sale", async function () {
            await invoiceNFT.connect(supplier).revokeInvoiceSale(0);

            await expect(
                invoiceNFT
                    .connect(financier)
                    .buyInvoice(0, { value: discountedPrice })
            ).to.be.rejected;
        });

        it("should revert if owner tries to buy their own NFT", async function () {
            await expect(
                invoiceNFT
                    .connect(supplier)
                    .buyInvoice(0, { value: discountedPrice })
            ).to.be.rejected;
        });

        it("should revert if payment amount is incorrect", async function () {
            await expect(
                invoiceNFT
                    .connect(financier)
                    .buyInvoice(0, { value: ethers.parseEther("0.5") })
            ).to.be.rejected;
        });
    });

    // ─────────────────────────────────────────────
    // Algorithm 9 — settleInvoice()
    // ─────────────────────────────────────────────
    describe("Algorithm 9 — settleInvoice()", function () {

        beforeEach(async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
            await invoiceNFT.connect(buyer).signInvoice(0);
            await invoiceNFT
                .connect(supplier)
                .approveInvoiceSale(0, discountedPrice);
            await invoiceNFT
                .connect(financier)
                .buyInvoice(0, { value: discountedPrice });
        });

        it("should transfer ETH to financier and NFT to buyer", async function () {
            const financierBalanceBefore = await ethers.provider.getBalance(
                financier.address
            );

            await invoiceNFT
                .connect(buyer)
                .settleInvoice(0, { value: invoiceAmount });

            expect(await invoiceNFT.ownerOf(0)).to.equal(buyer.address);

            const financierBalanceAfter = await ethers.provider.getBalance(
                financier.address
            );
            expect(financierBalanceAfter).to.be.gt(financierBalanceBefore);
        });

        it("should revert if caller is not the designated buyer", async function () {
            await expect(
                invoiceNFT
                    .connect(other)
                    .settleInvoice(0, { value: invoiceAmount })
            ).to.be.rejected;
        });

        it("should revert if invoice has not been approved by buyer", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_2, buyer.address, invoiceAmount, dueDate);

            await expect(
                invoiceNFT
                    .connect(buyer)
                    .settleInvoice(1, { value: invoiceAmount })
            ).to.be.rejected;
        });

        it("should revert if settlement amount is incorrect", async function () {
            await expect(
                invoiceNFT
                    .connect(buyer)
                    .settleInvoice(0, { value: ethers.parseEther("0.5") })
            ).to.be.rejected;
        });
    });

    // ─────────────────────────────────────────────
    // End-to-end flow
    // ─────────────────────────────────────────────
    describe("End-to-end flow", function () {

        it("should complete full cycle: mint → sign → list → buy → settle", async function () {
            await invoiceNFT
                .connect(supplier)
                .mintInvoice(CID_1, buyer.address, invoiceAmount, dueDate);
            expect(await invoiceNFT.ownerOf(0)).to.equal(supplier.address);

            await invoiceNFT.connect(buyer).signInvoice(0);
            expect((await invoiceNFT.InvoiceNFT_Map(0)).isApproved).to.equal(true);

            await invoiceNFT
                .connect(supplier)
                .approveInvoiceSale(0, discountedPrice);
            expect((await invoiceNFT.InvoiceNFT_Map(0)).forSale).to.equal(true);

            await invoiceNFT
                .connect(financier)
                .buyInvoice(0, { value: discountedPrice });
            expect(await invoiceNFT.ownerOf(0)).to.equal(financier.address);

            await invoiceNFT
                .connect(buyer)
                .settleInvoice(0, { value: invoiceAmount });
            expect(await invoiceNFT.ownerOf(0)).to.equal(buyer.address);
        });
    });
});