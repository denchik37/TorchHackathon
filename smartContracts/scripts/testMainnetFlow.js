const { ethers } = require("hardhat");

/**
 * Test the full prediction market flow on Hedera Mainnet
 * This simulates TorchV2.t.js but works on actual Hedera network
 */
module.exports = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TESTING TORCH PREDICTION MARKET ON HEDERA MAINNET");
  console.log("=".repeat(60));

  // Get signers - use your mainnet account
  const [owner, user1, user2, user3] = await ethers.getSigners();
  
  // Use the deployed contract address from mainnet
  // Replace with your actual deployed contract address
  const CONTRACT_ADDRESS = process.env.MAINNET_CONTRACT_ADDRESS || "0x4B3a0b8fb2640721510ACe8f0414bdfE0feA18f7";
  
  console.log(`\n📍 Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`👑 Owner: ${owner.address}`);
  console.log(`👤 User1: ${user1.address}`);
  console.log(`👤 User2: ${user2.address}`);
  console.log(`👤 User3: ${user3.address}`);

  // Attach to deployed contract
  const TorchPredictionMarket = await ethers.getContractFactory("TorchPredictionMarket");
  const contract = TorchPredictionMarket.attach(CONTRACT_ADDRESS);

  // Verify contract is accessible
  try {
    const code = await ethers.provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error("Contract not found at address");
    }
    console.log("✅ Contract verified on network");
  } catch (error) {
    console.error("❌ Error connecting to contract:", error.message);
    return;
  }

  // Get initial contract state
  const startTimestamp = await contract.startTimestamp();
  const nextBetId = await contract.nextBetId();
  const currentBlock = await ethers.provider.getBlock("latest");
  const currentTime = currentBlock.timestamp;

  console.log(`\n📊 Contract State:`);
  console.log(`  📅 Start Timestamp: ${startTimestamp}`);
  console.log(`  🆔 Next Bet ID: ${nextBetId}`);
  console.log(`  ⏰ Current Block Time: ${currentTime}`);

  // Calculate future timestamp (1 day ahead + buffer)
  const SECONDS_PER_DAY = 24 * 60 * 60;
  const MIN_DAYS_AHEAD = 1;
  const futureTimestamp = currentTime + (MIN_DAYS_AHEAD * SECONDS_PER_DAY) + 3600; // 1 day + 1 hour buffer

  console.log(`\n🎯 Target Timestamp: ${futureTimestamp}`);
  console.log(`   (${new Date(futureTimestamp * 1000).toISOString()})`);

  // Test parameters - using smaller amounts for mainnet testing
  // Hedera uses tinybar (1 HBAR = 10^8 tinybar), but ethers.js handles this
  const betAmount = ethers.utils.parseEther("0.1"); // 0.1 HBAR (smaller for testing)
  const priceMin = 2900;  // $0.29
  const priceMax = 3100;  // $0.31

  console.log(`\n💰 Bet Amount: ${ethers.utils.formatEther(betAmount)} HBAR`);

  // Check balances first
  console.log("\n=== CHECKING BALANCES ===");
  const ownerBalance = await ethers.provider.getBalance(owner.address);
  const user1Balance = await ethers.provider.getBalance(user1.address);
  const user2Balance = await ethers.provider.getBalance(user2.address);
  const user3Balance = await ethers.provider.getBalance(user3.address);

  console.log(`Owner: ${ethers.utils.formatEther(ownerBalance)} HBAR`);
  console.log(`User1: ${ethers.utils.formatEther(user1Balance)} HBAR`);
  console.log(`User2: ${ethers.utils.formatEther(user2Balance)} HBAR`);
  console.log(`User3: ${ethers.utils.formatEther(user3Balance)} HBAR`);

  // Verify users have enough balance
  const minRequired = betAmount.mul(2); // Need at least 2x for bet + gas
  if (user1Balance.lt(minRequired) || user2Balance.lt(minRequired) || user3Balance.lt(minRequired)) {
    console.log("\n⚠️ WARNING: Some users may not have enough balance for testing");
    console.log("   Consider funding accounts or using smaller bet amounts");
  }

  try {
    // ==============================================================
    // STEP 1: PLACE BETS
    // ==============================================================
    console.log("\n" + "=".repeat(60));
    console.log("STEP 1: PLACING BETS");
    console.log("=".repeat(60));

    // User1: predicts 2900-3100 (will win)
    console.log("\n🎲 User1 placing bet: price range 2900-3100");
    const tx1 = await contract.connect(user1).placeBet(
      futureTimestamp,
      2900,
      3100,
      { value: betAmount }
    );
    console.log(`⏳ Waiting for transaction: ${tx1.hash}`);
    const receipt1 = await tx1.wait();
    const betId1 = nextBetId; // First bet gets this ID
    console.log(`✅ User1 bet placed! Bet ID: ${betId1}`);
    console.log(`   Gas used: ${receipt1.gasUsed.toString()}`);

    // User2: predicts 2800-3200 (will win - wider range)
    console.log("\n🎲 User2 placing bet: price range 2800-3200");
    const tx2 = await contract.connect(user2).placeBet(
      futureTimestamp,
      2800,
      3200,
      { value: betAmount }
    );
    console.log(`⏳ Waiting for transaction: ${tx2.hash}`);
    const receipt2 = await tx2.wait();
    const betId2 = betId1 + 1;
    console.log(`✅ User2 bet placed! Bet ID: ${betId2}`);

    // User3: predicts 3500-3700 (will LOSE - price too high)
    console.log("\n🎲 User3 placing bet: price range 3500-3700 (will lose)");
    const tx3 = await contract.connect(user3).placeBet(
      futureTimestamp,
      3500,
      3700,
      { value: betAmount }
    );
    console.log(`⏳ Waiting for transaction: ${tx3.hash}`);
    const receipt3 = await tx3.wait();
    const betId3 = betId2 + 1;
    console.log(`✅ User3 bet placed! Bet ID: ${betId3}`);

    // Wait a bit for Hedera to process
    console.log("\n⏳ Waiting 5 seconds for Hedera to process...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get bucket info
    const bucket = await contract.bucketIndex(futureTimestamp);
    const bucketInfo = await contract.getBucketInfo(bucket);
    const bucketStats = await contract.getBucketStats(bucket);

    console.log(`\n📊 Bucket ${bucket} Info:`);
    console.log(`  Total bets: ${bucketInfo.totalBets}`);
    console.log(`  Total staked: ${ethers.utils.formatEther(bucketStats.totalStaked)} HBAR`);
    console.log(`  Total weight: ${bucketStats.totalWeight}`);

    // Get bet details
    const bet1 = await contract.getBet(betId1);
    const bet2 = await contract.getBet(betId2);
    const bet3 = await contract.getBet(betId3);

    console.log(`\n📋 Bet Details:`);
    console.log(`Bet1: stake=${ethers.utils.formatEther(bet1.stake)} HBAR, weight=${bet1.weight}`);
    console.log(`Bet2: stake=${ethers.utils.formatEther(bet2.stake)} HBAR, weight=${bet2.weight}`);
    console.log(`Bet3: stake=${ethers.utils.formatEther(bet3.stake)} HBAR, weight=${bet3.weight}`);

    // ==============================================================
    // STEP 2: WAIT FOR TARGET TIMESTAMP (or simulate by setting price)
    // ==============================================================
    console.log("\n" + "=".repeat(60));
    console.log("STEP 2: SETTING ACTUAL PRICE");
    console.log("=".repeat(60));
    console.log("⚠️ NOTE: On mainnet, you must wait for the target timestamp");
    console.log("   or set the price after the timestamp has passed");

    // For testing, we'll set the price now (assuming timestamp has passed or will pass)
    const actualPrice = 3000; // $0.30 - User1 and User2 win, User3 loses
    console.log(`\n💰 Setting actual price to: ${actualPrice}`);
    
    const setPriceTx = await contract.connect(owner).setPriceForTimestamp(futureTimestamp, actualPrice);
    console.log(`⏳ Waiting for transaction: ${setPriceTx.hash}`);
    await setPriceTx.wait();
    console.log(`✅ Price set to ${actualPrice}`);

    // ==============================================================
    // STEP 3: PROCESS BATCH
    // ==============================================================
    console.log("\n" + "=".repeat(60));
    console.log("STEP 3: PROCESSING BATCH");
    console.log("=".repeat(60));

    const bucketInfoBefore = await contract.getBucketInfo(bucket);
    console.log(`Processing bucket ${bucket}...`);
    console.log(`Bets to process: ${bucketInfoBefore.totalBets}`);

    const processTx = await contract.processBatch(bucket);
    console.log(`⏳ Waiting for transaction: ${processTx.hash}`);
    await processTx.wait();

    const bucketInfoAfter = await contract.getBucketInfo(bucket);
    console.log(`✅ Batch processed!`);
    console.log(`  Processed: ${bucketInfoAfter.nextProcessIndex} bets`);
    console.log(`  Total winning weight: ${bucketInfoAfter.totalWinningWeight}`);
    console.log(`  Aggregation complete: ${bucketInfoAfter.aggregationComplete}`);

    // Check finalized bets
    const finalizedBet1 = await contract.getBet(betId1);
    const finalizedBet2 = await contract.getBet(betId2);
    const finalizedBet3 = await contract.getBet(betId3);

    console.log(`\n📊 Finalized Bet Results:`);
    console.log(`Bet1: finalized=${finalizedBet1.finalized}, won=${finalizedBet1.won}, actualPrice=${finalizedBet1.actualPrice}`);
    console.log(`Bet2: finalized=${finalizedBet2.finalized}, won=${finalizedBet2.won}, actualPrice=${finalizedBet2.actualPrice}`);
    console.log(`Bet3: finalized=${finalizedBet3.finalized}, won=${finalizedBet3.won}, actualPrice=${finalizedBet3.actualPrice}`);

    // ==============================================================
    // STEP 4: CLAIM BETS
    // ==============================================================
    console.log("\n" + "=".repeat(60));
    console.log("STEP 4: CLAIMING BETS");
    console.log("=".repeat(60));

    // Get balances before claiming
    const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
    const user2BalanceBefore = await ethers.provider.getBalance(user2.address);
    const user3BalanceBefore = await ethers.provider.getBalance(user3.address);

    console.log("\n💰 Balances before claiming:");
    console.log(`User1: ${ethers.utils.formatEther(user1BalanceBefore)} HBAR`);
    console.log(`User2: ${ethers.utils.formatEther(user2BalanceBefore)} HBAR`);
    console.log(`User3: ${ethers.utils.formatEther(user3BalanceBefore)} HBAR`);

    // Claim bets
    console.log("\n🎯 Claiming bets...");
    
    if (finalizedBet1.won) {
      const claimTx1 = await contract.connect(user1).claimBet(betId1);
      console.log(`User1 claiming: ${claimTx1.hash}`);
      await claimTx1.wait();
      console.log(`✅ User1 claimed!`);
    }

    if (finalizedBet2.won) {
      const claimTx2 = await contract.connect(user2).claimBet(betId2);
      console.log(`User2 claiming: ${claimTx2.hash}`);
      await claimTx2.wait();
      console.log(`✅ User2 claimed!`);
    }

    const claimTx3 = await contract.connect(user3).claimBet(betId3);
    console.log(`User3 claiming: ${claimTx3.hash}`);
    await claimTx3.wait();
    console.log(`✅ User3 claimed!`);

    // Get balances after claiming
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for Hedera
    const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
    const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
    const user3BalanceAfter = await ethers.provider.getBalance(user3.address);

    console.log("\n💰 Balances after claiming:");
    console.log(`User1: ${ethers.utils.formatEther(user1BalanceAfter)} HBAR`);
    console.log(`User2: ${ethers.utils.formatEther(user2BalanceAfter)} HBAR`);
    console.log(`User3: ${ethers.utils.formatEther(user3BalanceAfter)} HBAR`);

    // Calculate payouts
    const user1Payout = user1BalanceAfter.sub(user1BalanceBefore);
    const user2Payout = user2BalanceAfter.sub(user2BalanceBefore);
    const user3Payout = user3BalanceAfter.sub(user3BalanceBefore);

    console.log("\n📊 Payouts:");
    console.log(`User1 (winner): ${ethers.utils.formatEther(user1Payout)} HBAR`);
    console.log(`User2 (winner): ${ethers.utils.formatEther(user2Payout)} HBAR`);
    console.log(`User3 (loser): ${ethers.utils.formatEther(user3Payout)} HBAR`);

    // ==============================================================
    // FINAL SUMMARY
    // ==============================================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ TEST COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`\nContract: ${CONTRACT_ADDRESS}`);
    console.log(`Bucket: ${bucket}`);
    console.log(`Bets placed: ${betId1}, ${betId2}, ${betId3}`);
    console.log(`Actual price: ${actualPrice}`);
    console.log(`Winners: User1 (${finalizedBet1.won}), User2 (${finalizedBet2.won}), User3 (${finalizedBet3.won})`);

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    if (error.data) {
      console.error("Data:", error.data);
    }
    throw error;
  }
};

