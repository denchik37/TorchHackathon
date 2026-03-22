const { ethers } = require("hardhat");

/**
 * End-to-end flow on Hedera (or any network): ERC20 market + collateral token.
 * Mirrors scripts/testMainnetFlow.js (bets → set price → processBatch → claim).
 *
 * Env:
 *   TORCH_ERC20_MARKET_ADDRESS – deployed TorchPredictionMarketERC20
 *
 * Optional first argument: market address (used by deploy-and-test task on ephemeral Hardhat).
 *
 * Collateral is read from the market. For MockERC20, each test user mints MCOL to themselves.
 */
module.exports = async (marketAddressOverride) => {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TorchPredictionMarketERC20 – on-chain flow");
  console.log("=".repeat(60));

  const CONTRACT_ADDRESS =
    marketAddressOverride ||
    process.env.TORCH_ERC20_MARKET_ADDRESS ||
    process.env.DEPLOYED_ERC20_MARKET_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "Set TORCH_ERC20_MARKET_ADDRESS (or DEPLOYED_ERC20_MARKET_ADDRESS), or pass market address",
    );
  }

  const signers = await ethers.getSigners();
  const owner = signers[0];
  let user1;
  let user2;
  let user3;

  if (signers.length >= 4) {
    [, user1, user2, user3] = signers;
  } else {
    const provider = ethers.provider;
    const gasFund = ethers.utils.parseEther("10");
    user1 = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
    user2 = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
    user3 = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
    for (const w of [user1, user2, user3]) {
      await (await owner.sendTransaction({ to: w.address, value: gasFund })).wait();
    }
    console.log("ℹ️ Single funded key: created user1/2/3 EOAs and sent HBAR for gas.");
  }

  const Market = await ethers.getContractFactory("TorchPredictionMarketERC20");
  const contract = Market.attach(CONTRACT_ADDRESS);

  const code = await ethers.provider.getCode(CONTRACT_ADDRESS);
  if (code === "0x") {
    throw new Error("No contract at TORCH_ERC20_MARKET_ADDRESS");
  }

  const tokenAddr = await contract.collateralToken();
  const token = await ethers.getContractAt("MockERC20", tokenAddr);

  const ERC20_ABI = [
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ];

  const startTimestamp = await contract.startTimestamp();
  const nextBetIdStart = await contract.nextBetId();
  const block = await ethers.provider.getBlock("latest");
  const currentTime = block.timestamp;

  console.log(`📍 Market: ${CONTRACT_ADDRESS}`);
  console.log(`🪙 Token: ${tokenAddr}`);
  console.log(`👑 Owner: ${owner.address}`);
  console.log(`👤 Users: ${user1.address}, ${user2.address}, ${user3.address}`);
  console.log(`📅 startTimestamp: ${startTimestamp} | nextBetId: ${nextBetIdStart}`);

  const SECONDS_PER_DAY = 24 * 60 * 60;
  const MIN_DAYS_AHEAD = 1;
  const futureTimestamp = currentTime + MIN_DAYS_AHEAD * SECONDS_PER_DAY + 3600;

  const betAmount = ethers.utils.parseEther(
    process.env.ERC20_TEST_BET_AMOUNT || "0.1",
  );

  for (const u of [user1, user2, user3]) {
    await (await token.connect(u).mint(u.address, betAmount.mul(20))).wait();
  }

  async function approveAndPlace(u, pMin, pMax) {
    const t = token.connect(u);
    const m = contract.connect(u);
    const al = await t.allowance(u.address, CONTRACT_ADDRESS);
    if (al.lt(betAmount)) {
      await (await t.approve(CONTRACT_ADDRESS, betAmount.mul(50))).wait();
    }
    const tx = await m.placeBet(futureTimestamp, pMin, pMax, betAmount);
    await tx.wait();
    return tx.hash;
  }

  console.log("\n=== STEP 1: PLACE BETS (ERC20) ===");
  await approveAndPlace(user1, 2900, 3100);
  await approveAndPlace(user2, 2800, 3200);
  await approveAndPlace(user3, 3500, 3700);

  const betId1 = nextBetIdStart;
  const betId2 = betId1.add(1);
  const betId3 = betId2.add(1);

  const bucket = await contract.bucketIndex(futureTimestamp);
  console.log(`Bucket ${bucket} | bets ${betId1} ${betId2} ${betId3}`);

  console.log("\n=== STEP 2: SET PRICE ===");
  const actualPrice = 3000;
  await (
    await contract.connect(owner).setPriceForTimestamp(futureTimestamp, actualPrice)
  ).wait();
  console.log(`Price ${actualPrice} for ts ${futureTimestamp}`);

  console.log("\n=== STEP 3: PROCESS BATCH ===");
  await (await contract.processBatch(bucket)).wait();

  const f1 = await contract.getBet(betId1);
  const f2 = await contract.getBet(betId2);
  const f3 = await contract.getBet(betId3);
  console.log(`Finalized: u1 won=${f1.won} u2 won=${f2.won} u3 won=${f3.won}`);

  console.log("\n=== STEP 4: CLAIM (ERC20 balances) ===");
  const c1 = new ethers.Contract(tokenAddr, ERC20_ABI, user1);
  const c2 = new ethers.Contract(tokenAddr, ERC20_ABI, user2);
  const c3 = new ethers.Contract(tokenAddr, ERC20_ABI, user3);

  const b1a = await c1.balanceOf(user1.address);
  const b2a = await c2.balanceOf(user2.address);
  const b3a = await c3.balanceOf(user3.address);

  await (await contract.connect(user1).claimBet(betId1)).wait();
  await (await contract.connect(user2).claimBet(betId2)).wait();
  await (await contract.connect(user3).claimBet(betId3)).wait();

  const b1b = await c1.balanceOf(user1.address);
  const b2b = await c2.balanceOf(user2.address);
  const b3b = await c3.balanceOf(user3.address);

  console.log(`User1 token delta: ${ethers.utils.formatEther(b1b.sub(b1a))}`);
  console.log(`User2 token delta: ${ethers.utils.formatEther(b2b.sub(b2a))}`);
  console.log(`User3 token delta: ${ethers.utils.formatEther(b3b.sub(b3a))}`);

  console.log("\n✅ ERC20 flow completed");
  return { CONTRACT_ADDRESS, bucket, betId1: betId1.toString() };
};
