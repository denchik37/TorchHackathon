const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TorchPredictionMarketSauce", function () {
  let contract, token, owner, user1, user2;

  const SECONDS_PER_DAY = 24 * 60 * 60;
  const FEE_BPS = 50;
  const BPS_DENOM = 10000;

  const TOKEN_DECIMALS = 6;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy(
      "MockSauce",
      "SAUCE",
      TOKEN_DECIMALS,
      ethers.utils.parseUnits("1000000", TOKEN_DECIMALS)
    );
    await token.deployed();

    // Distribute balances to test users.
    await token.transfer(user1.address, ethers.utils.parseUnits("1000", TOKEN_DECIMALS));
    await token.transfer(user2.address, ethers.utils.parseUnits("1000", TOKEN_DECIMALS));

    const TorchPredictionMarketSauce = await ethers.getContractFactory("TorchPredictionMarketSauce");
    contract = await TorchPredictionMarketSauce.deploy(token.address);
    await contract.deployed();
  });

  describe("Constructor + view", function () {
    it("should initialize nextBetId to 0", async function () {
      expect(await contract.nextBetId()).to.equal(0);
    });

    it("should set startTimestamp correctly", async function () {
      expect(await contract.startTimestamp()).to.be.gt(0);
    });

    it("should set stakeToken correctly", async function () {
      expect(await contract.stakeToken()).to.equal(token.address);
    });
  });

  describe("bucketIndex", function () {
    it("should return 0 for startTimestamp", async function () {
      const startTimestamp = await contract.startTimestamp();
      expect(await contract.bucketIndex(startTimestamp)).to.equal(0);
    });
  });

  describe("placeBet + claimBet flow (SAUCE stake)", function () {
    it("should place a bet and escrow SAUCE (fee deducted from stakeNet)", async function () {
      const futureTimestamp =
        Math.floor(Date.now() / 1000) + SECONDS_PER_DAY + 3600; // >= MIN_DAYS_AHEAD + buffer

      const priceMin = 100;
      const priceMax = 200;
      const stakeAmount = ethers.utils.parseUnits("10", TOKEN_DECIMALS); // 10 SAUCE (gross)

      await token.connect(user1).approve(contract.address, stakeAmount);

      const contractBalanceBefore = await token.balanceOf(contract.address);

      const tx = await contract
        .connect(user1)
        .placeBet(futureTimestamp, priceMin, priceMax, stakeAmount);

      const receipt = await tx.wait();

      const event = receipt.events.find((e) => e.event === "BetPlaced");
      expect(event).to.not.be.undefined;
      expect(event.args.betId).to.equal(0);
      expect(event.args.bettor).to.equal(user1.address);

      const expectedFee = stakeAmount.mul(FEE_BPS).div(BPS_DENOM);
      const expectedStakeNet = stakeAmount.sub(expectedFee);

      expect(event.args.stake).to.equal(expectedStakeNet);

      const bet = await contract.getBet(0);
      expect(bet.bettor).to.equal(user1.address);
      expect(bet.targetTimestamp).to.equal(futureTimestamp);
      expect(bet.priceMin).to.equal(priceMin);
      expect(bet.priceMax).to.equal(priceMax);
      expect(bet.stake).to.equal(expectedStakeNet);
      expect(bet.finalized).to.equal(false);
      expect(bet.claimed).to.equal(false);

      // Contract escrows the gross stake amount.
      const contractBalanceAfter = await token.balanceOf(contract.address);
      expect(contractBalanceAfter.sub(contractBalanceBefore)).to.equal(stakeAmount);

      // Total fees collected should equal expectedFee.
      expect(await contract.totalFeesCollected()).to.equal(expectedFee);
    });

    it("should resolve one winning bet and pay the entire net pool in SAUCE", async function () {
      const futureTimestamp =
        Math.floor(Date.now() / 1000) + SECONDS_PER_DAY + 3600;

      const bucket = await contract.bucketIndex(futureTimestamp);

      // Bet 1 (user1) wins if actualPrice=150 is within [100,200]
      const priceMin1 = 100;
      const priceMax1 = 200;
      const stake1 = ethers.utils.parseUnits("50", TOKEN_DECIMALS);

      // Bet 2 (user2) loses if actualPrice=150 is outside [210,300]
      const priceMin2 = 210;
      const priceMax2 = 300;
      const stake2 = ethers.utils.parseUnits("80", TOKEN_DECIMALS);

      await token.connect(user1).approve(contract.address, stake1);
      await token.connect(user2).approve(contract.address, stake2);

      await contract.connect(user1).placeBet(futureTimestamp, priceMin1, priceMax1, stake1);
      await contract.connect(user2).placeBet(futureTimestamp, priceMin2, priceMax2, stake2);

      // Set oracle price for the timestamp (owner-only).
      const actualPrice = 150;
      await contract.connect(owner).setPriceForTimestamp(futureTimestamp, actualPrice);

      // Anyone can process the bucket.
      await contract.processBatch(bucket);

      const bet1 = await contract.getBet(0);
      const bet2 = await contract.getBet(1);
      expect(bet1.finalized).to.equal(true);
      expect(bet1.won).to.equal(true);
      expect(bet2.finalized).to.equal(true);
      expect(bet2.won).to.equal(false);

      // Before claim balances (after escrow and before payout)
      const user1BalanceBefore = await token.balanceOf(user1.address);

      const stakeNet1 = stake1.sub(stake1.mul(FEE_BPS).div(BPS_DENOM));
      const stakeNet2 = stake2.sub(stake2.mul(FEE_BPS).div(BPS_DENOM));

      const expectedPayout = stakeNet1.add(stakeNet2); // only winner => receives entire net pool

      await contract.connect(user1).claimBet(0);

      const user1BalanceAfter = await token.balanceOf(user1.address);
      expect(user1BalanceAfter.sub(user1BalanceBefore)).to.equal(expectedPayout);

      // Loser can claim too, but should get 0 payout and no token transfer.
      const user2BalanceBefore = await token.balanceOf(user2.address);
      await contract.connect(user2).claimBet(1);
      const user2BalanceAfter = await token.balanceOf(user2.address);
      expect(user2BalanceAfter.sub(user2BalanceBefore)).to.equal(0);

      const finalBet1 = await contract.getBet(0);
      const finalBet2 = await contract.getBet(1);
      expect(finalBet1.claimed).to.equal(true);
      expect(finalBet2.claimed).to.equal(true);
    });
  });
});

