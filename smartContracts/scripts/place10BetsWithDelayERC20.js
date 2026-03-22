const { ethers } = require("hardhat");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createBetData(dayOffset, priceMin, priceMax, stakeEther) {
  return {
    dayOffset,
    priceMin,
    priceMax,
    stakeAmount: ethers.utils.parseEther(stakeEther.toString()),
  };
}

/**
 * Same layout as place10BetsWithDelay.js but for TorchPredictionMarketERC20 + ERC20 approve.
 * Env: TORCH_ERC20_MARKET_ADDRESS (required)
 */
module.exports = async () => {
  const [deployer] = await ethers.getSigners();
  const marketAddress =
    process.env.TORCH_ERC20_MARKET_ADDRESS ||
    process.env.DEPLOYED_ERC20_MARKET_ADDRESS;

  if (!marketAddress) {
    throw new Error(
      "Set TORCH_ERC20_MARKET_ADDRESS or DEPLOYED_ERC20_MARKET_ADDRESS",
    );
  }

  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    marketAddress,
    deployer,
  );

  const tokenAddr = await market.collateralToken();
  const token = await ethers.getContractAt("MockERC20", tokenAddr, deployer);

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const MIN_DAYS_AHEAD = await market.MIN_DAYS_AHEAD();
  const SECONDS_PER_DAY = await market.SECONDS_PER_DAY();

  const bets = [
    createBetData(1, 2100, 2550, 0.001),
    createBetData(1, 2320, 2820, 0.0015),
    createBetData(1, 2000, 2600, 0.002),
    createBetData(2, 2650, 3150, 0.0025),
    createBetData(2, 2450, 2930, 0.003),
    createBetData(2, 2200, 2650, 0.0012),
    createBetData(3, 2050, 2800, 0.0018),
    createBetData(3, 2750, 3450, 0.0022),
    createBetData(3, 2900, 3500, 0.0028),
    createBetData(2, 2200, 3200, 0.0017),
  ];

  let totalNeeded = ethers.BigNumber.from(0);
  for (const b of bets) {
    totalNeeded = totalNeeded.add(b.stakeAmount);
  }

  console.log("Market:", marketAddress);
  console.log("Token:", tokenAddr);
  console.log("Deployer:", deployer.address);
  console.log("Total stake needed (gross):", ethers.utils.formatEther(totalNeeded));

  const allowance = await token.allowance(deployer.address, marketAddress);
  if (allowance.lt(totalNeeded)) {
    console.log("Approving market for total stake...");
    await (await token.approve(marketAddress, totalNeeded)).wait();
  }

  console.log("=== Placing 10 bets (ERC20) ===");

  for (let i = 0; i < bets.length; i++) {
    const bet = bets[i];
    const minDays = MIN_DAYS_AHEAD.add(bet.dayOffset).toNumber();
    const spd = SECONDS_PER_DAY.toNumber();
    const targetTimestamp = currentTimestamp + minDays * spd;

    console.log(`--- Bet ${i + 1} --- targetTs ${targetTimestamp}`);
    const tx = await market.placeBet(
      targetTimestamp,
      bet.priceMin,
      bet.priceMax,
      bet.stakeAmount,
    );
    await tx.wait();
    console.log("   ok", tx.hash);
    if (i < bets.length - 1) {
      console.log("   sleep 3s...");
      await sleep(3000);
    }
  }

  const stats = await market.getStats();
  console.log("=== Done ===");
  console.log("nextBetId / totalFees / token on market:", {
    nextBetId: stats.totalBets.toString(),
    totalFees: ethers.utils.formatEther(stats.totalFees),
    contractBalance: ethers.utils.formatEther(stats.contractBalance),
  });

  return stats;
};
