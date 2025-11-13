const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TorchPredictionMarketV2", function () {
  let contract, owner, user1, user2, user3;
  const SECONDS_PER_DAY = 24 * 60 * 60;
  const MIN_DAYS_AHEAD = 1;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    // Use the current TorchPredictionMarket contract
    const TorchPredictionMarket = await ethers.getContractFactory("TorchPredictionMarket");
    contract = await TorchPredictionMarket.deploy();
    await contract.deployed();
  });

  describe("Deployment and Basic Flow", function () {
    const betAmount = ethers.utils.parseEther("1.0");
    let futureTimestamp;
    const priceMin = 2900;  // $0.29
    const priceMax = 3100;  // $0.31

    beforeEach(async function () {
      // Calculate future timestamp - at least 1 day ahead
      const currentBlock = await ethers.provider.getBlock("latest");
      futureTimestamp = currentBlock.timestamp + (MIN_DAYS_AHEAD * SECONDS_PER_DAY) + 3600; // Add 1 hour buffer
    });

    it("should deploy the contract successfully", async function () {
      expect(contract.address).to.be.properAddress;
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should place a bet successfully", async function () {
      const tx = await contract.connect(user1).placeBet(
        futureTimestamp,
        priceMin,
        priceMax,
        { value: betAmount }
      );

      const receipt = await tx.wait();
      
      // Find BetPlaced event
      const event = receipt.events.find(e => e.event === "BetPlaced");

      expect(event).to.not.be.undefined;
      expect(event.args.bettor).to.equal(user1.address);
      expect(event.args.priceMin).to.equal(priceMin);
      expect(event.args.priceMax).to.equal(priceMax);
      
      // Verify bet was created
      const betId = event.args.betId;
      const bet = await contract.getBet(betId);
      expect(bet.bettor).to.equal(user1.address);
    });

    it("should complete full flow: 3 users place bets, 1 loses, 2 win and share the pool", async function () {
      // Get initial balances
      const user1InitialBalance = await ethers.provider.getBalance(user1.address);
      const user2InitialBalance = await ethers.provider.getBalance(user2.address);
      const user3InitialBalance = await ethers.provider.getBalance(user3.address);
      
      console.log("\n=== STEP 1: PLACING BETS ===");
      console.log(`User1 initial balance: ${ethers.utils.formatEther(user1InitialBalance)} ETH`);
      console.log(`User2 initial balance: ${ethers.utils.formatEther(user2InitialBalance)} ETH`);
      console.log(`User3 initial balance: ${ethers.utils.formatEther(user3InitialBalance)} ETH`);
      console.log(`Each user betting: ${ethers.utils.formatEther(betAmount)} ETH\n`);

      // Step 1: All 3 users place bets with same amount
      // User1: predicts 2900-3100 (will win)
      console.log("User1 placing bet: price range 2900-3100");
      const tx1 = await contract.connect(user1).placeBet(
        futureTimestamp,
        2900, // $0.29
        3100, // $0.31
        { value: betAmount }
      );
      await tx1.wait();
      const betId1 = 0;

      // User2: predicts 2800-3200 (will win - wider range)
      console.log("User2 placing bet: price range 2800-3200");
      const tx2 = await contract.connect(user2).placeBet(
        futureTimestamp,
        2800, // $0.28
        3200, // $0.32
        { value: betAmount }
      );
      await tx2.wait();
      const betId2 = 1;

      // User3: predicts 3500-3700 (will LOSE - price too high)
      console.log("User3 placing bet: price range 3500-3700 (will lose)");
      const tx3 = await contract.connect(user3).placeBet(
        futureTimestamp,
        3500, // $0.35
        3700, // $0.37
        { value: betAmount }
      );
      await tx3.wait();
      const betId3 = 2;

      // Get bucket and verify all bets are tracked
      const bucket = await contract.bucketIndex(futureTimestamp);
      const bucketInfo = await contract.getBucketInfo(bucket);
      const bucketStats = await contract.getBucketStats(bucket);
      console.log(`\nBucket: ${bucket}`);
      console.log(`Total bets in bucket: ${bucketInfo.totalBets}`);
      console.log(`Total staked: ${ethers.utils.formatEther(bucketStats.totalStaked)} ETH`);
      expect(bucketInfo.totalBets).to.equal(3);

      // Get bet details
      const bet1 = await contract.getBet(betId1);
      const bet2 = await contract.getBet(betId2);
      const bet3 = await contract.getBet(betId3);
      
      console.log(`\nBet1 (User1): stake=${ethers.utils.formatEther(bet1.stake)} ETH, weight=${bet1.weight}`);
      console.log(`Bet2 (User2): stake=${ethers.utils.formatEther(bet2.stake)} ETH, weight=${bet2.weight}`);
      console.log(`Bet3 (User3): stake=${ethers.utils.formatEther(bet3.stake)} ETH, weight=${bet3.weight}`);

      // Step 2: Fast forward time
      console.log("\n=== STEP 2: FAST FORWARDING TIME ===");
      await ethers.provider.send("evm_setNextBlockTimestamp", [futureTimestamp + 1]);
      await ethers.provider.send("evm_mine");
      console.log("Time advanced past target timestamp");

      // Step 3: Set actual price (3000 - within User1 and User2's ranges, but NOT User3's)
      console.log("\n=== STEP 3: SETTING ACTUAL PRICE ===");
      const actualPrice = 3000; // $0.30 - User1 and User2 win, User3 loses
      await contract.connect(owner).setPriceForTimestamp(futureTimestamp, actualPrice);
      console.log(`Actual price set to: ${actualPrice} (within User1 and User2's ranges, outside User3's range)`);

      // Step 4: Process batch
      console.log("\n=== STEP 4: PROCESSING BATCH ===");
      const bucketInfoBefore = await contract.getBucketInfo(bucket);
      await contract.processBatch(bucket);
      
      const bucketInfoAfter = await contract.getBucketInfo(bucket);
      console.log(`Bets processed: ${bucketInfoAfter.nextProcessIndex}`);
      console.log(`Total winning weight: ${bucketInfoAfter.totalWinningWeight}`);
      console.log(`Aggregation complete: ${bucketInfoAfter.aggregationComplete}`);

      // Verify all bets are finalized
      const finalizedBet1 = await contract.getBet(betId1);
      const finalizedBet2 = await contract.getBet(betId2);
      const finalizedBet3 = await contract.getBet(betId3);

      console.log(`\nBet1 (User1): finalized=${finalizedBet1.finalized}, won=${finalizedBet1.won}, actualPrice=${finalizedBet1.actualPrice}`);
      console.log(`Bet2 (User2): finalized=${finalizedBet2.finalized}, won=${finalizedBet2.won}, actualPrice=${finalizedBet2.actualPrice}`);
      console.log(`Bet3 (User3): finalized=${finalizedBet3.finalized}, won=${finalizedBet3.won}, actualPrice=${finalizedBet3.actualPrice}`);

      expect(finalizedBet1.finalized).to.be.true;
      expect(finalizedBet1.won).to.be.true;
      expect(finalizedBet2.finalized).to.be.true;
      expect(finalizedBet2.won).to.be.true;
      expect(finalizedBet3.finalized).to.be.true;
      expect(finalizedBet3.won).to.be.false; // User3 should lose

      // Step 5: All users claim their bets
      console.log("\n=== STEP 5: CLAIMING BETS ===");
      
      // Get balances before claiming
      const user1BalanceBeforeClaim = await ethers.provider.getBalance(user1.address);
      const user2BalanceBeforeClaim = await ethers.provider.getBalance(user2.address);
      const user3BalanceBeforeClaim = await ethers.provider.getBalance(user3.address);

      console.log("\nBefore claiming:");
      console.log(`User1 balance: ${ethers.utils.formatEther(user1BalanceBeforeClaim)} ETH`);
      console.log(`User2 balance: ${ethers.utils.formatEther(user2BalanceBeforeClaim)} ETH`);
      console.log(`User3 balance: ${ethers.utils.formatEther(user3BalanceBeforeClaim)} ETH`);

      // Get bucket stats for payout calculation
      const bucketStatsForPayout = await contract.getBucketStats(bucket);
      const totalStaked = bucketStatsForPayout.totalStaked;
      const totalWinningWeight = bucketInfoAfter.totalWinningWeight;
      const expectedPayout1 = totalWinningWeight.gt(0) ? finalizedBet1.weight.mul(totalStaked).div(totalWinningWeight) : ethers.BigNumber.from(0);
      const expectedPayout2 = totalWinningWeight.gt(0) ? finalizedBet2.weight.mul(totalStaked).div(totalWinningWeight) : ethers.BigNumber.from(0);
      
      console.log(`\nExpected payouts:`);
      console.log(`User1 (winner): ${ethers.utils.formatEther(expectedPayout1)} ETH`);
      console.log(`User2 (winner): ${ethers.utils.formatEther(expectedPayout2)} ETH`);
      console.log(`User3 (loser): 0 ETH (lost stake)`);
      console.log(`Total pool: ${ethers.utils.formatEther(totalStaked)} ETH`);
      console.log(`Total winning weight: ${totalWinningWeight}`);

      // Claim bets
      console.log("\nClaiming bets...");
      const claimTx1 = await contract.connect(user1).claimBet(betId1);
      const claimReceipt1 = await claimTx1.wait();
      const gasUsed1 = claimReceipt1.gasUsed.mul(claimReceipt1.gasPrice || ethers.BigNumber.from(0));

      const claimTx2 = await contract.connect(user2).claimBet(betId2);
      const claimReceipt2 = await claimTx2.wait();
      const gasUsed2 = claimReceipt2.gasUsed.mul(claimReceipt2.gasPrice || ethers.BigNumber.from(0));

      const claimTx3 = await contract.connect(user3).claimBet(betId3);
      const claimReceipt3 = await claimTx3.wait();
      const gasUsed3 = claimReceipt3.gasUsed.mul(claimReceipt3.gasPrice || ethers.BigNumber.from(0));

      // Get balances after claiming
      const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
      const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
      const user3BalanceAfter = await ethers.provider.getBalance(user3.address);

      // Calculate actual payouts (accounting for gas)
      const user1Payout = user1BalanceAfter.sub(user1BalanceBeforeClaim.sub(gasUsed1));
      const user2Payout = user2BalanceAfter.sub(user2BalanceBeforeClaim.sub(gasUsed2));
      const user3Payout = user3BalanceAfter.sub(user3BalanceBeforeClaim.sub(gasUsed3));

      console.log("\n=== FINAL RESULTS ===");
      console.log(`\nUser1 (WINNER):`);
      console.log(`  Initial: ${ethers.utils.formatEther(user1InitialBalance)} ETH`);
      console.log(`  Bet placed: -${ethers.utils.formatEther(betAmount)} ETH`);
      console.log(`  Payout received: +${ethers.utils.formatEther(user1Payout)} ETH`);
      console.log(`  Final balance: ${ethers.utils.formatEther(user1BalanceAfter)} ETH`);
      console.log(`  Net result: ${ethers.utils.formatEther(user1BalanceAfter.sub(user1InitialBalance))} ETH`);

      console.log(`\nUser2 (WINNER):`);
      console.log(`  Initial: ${ethers.utils.formatEther(user2InitialBalance)} ETH`);
      console.log(`  Bet placed: -${ethers.utils.formatEther(betAmount)} ETH`);
      console.log(`  Payout received: +${ethers.utils.formatEther(user2Payout)} ETH`);
      console.log(`  Final balance: ${ethers.utils.formatEther(user2BalanceAfter)} ETH`);
      console.log(`  Net result: ${ethers.utils.formatEther(user2BalanceAfter.sub(user2InitialBalance))} ETH`);

      console.log(`\nUser3 (LOSER):`);
      console.log(`  Initial: ${ethers.utils.formatEther(user3InitialBalance)} ETH`);
      console.log(`  Bet placed: -${ethers.utils.formatEther(betAmount)} ETH`);
      console.log(`  Payout received: ${ethers.utils.formatEther(user3Payout)} ETH`);
      console.log(`  Final balance: ${ethers.utils.formatEther(user3BalanceAfter)} ETH`);
      console.log(`  Net result: ${ethers.utils.formatEther(user3BalanceAfter.sub(user3InitialBalance))} ETH (lost stake)`);

      console.log(`\nTotal pool distributed: ${ethers.utils.formatEther(user1Payout.add(user2Payout))} ETH`);
      console.log(`User3's lost stake: ${ethers.utils.formatEther(bet3.stake)} ETH (shared by winners)`);
      console.log("\n✅ Full flow completed successfully!");

      // Verify claims
      const claimedBet1 = await contract.getBet(betId1);
      const claimedBet2 = await contract.getBet(betId2);
      const claimedBet3 = await contract.getBet(betId3);
      
      expect(claimedBet1.claimed).to.be.true;
      expect(claimedBet2.claimed).to.be.true;
      expect(claimedBet3.claimed).to.be.true;

      // Verify winners received payouts (accounting for gas costs)
      expect(user1Payout.gt(0)).to.be.true;
      expect(user2Payout.gt(0)).to.be.true;
      // User3 (loser) should have negative payout due to gas, but no contract payout
      // The payout is negative because they paid gas but received nothing from the contract
      expect(user3Payout.lte(0)).to.be.true; // Loser gets nothing (payout is negative due to gas)
    });

    it("should handle multiple bets in same bucket", async function () {
      const bucket = await contract.bucketIndex(futureTimestamp);
      
      // Place multiple bets
      await contract.connect(user1).placeBet(futureTimestamp, 2900, 3100, { value: betAmount });
      await contract.connect(user1).placeBet(futureTimestamp, 2800, 3200, { value: betAmount });

      const bucketInfo = await contract.getBucketInfo(bucket);
      expect(bucketInfo.totalBets).to.equal(2);

      // Set price
      await ethers.provider.send("evm_setNextBlockTimestamp", [futureTimestamp + 1]);
      await ethers.provider.send("evm_mine");
      await contract.connect(owner).setPriceForTimestamp(futureTimestamp, 3000);

      // Process batch
      const bucketInfoBefore = await contract.getBucketInfo(bucket);
      await contract.processBatch(bucket);
      
      // Verify state changes
      const bucketInfoAfter = await contract.getBucketInfo(bucket);
      expect(bucketInfoAfter.nextProcessIndex).to.equal(2); // Both bets processed
      expect(bucketInfoAfter.totalWinningWeight).to.be.gt(0);
      expect(bucketInfoAfter.aggregationComplete).to.be.true;
    });
  });
});
