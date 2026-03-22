const { ethers, network } = require("hardhat");
const { deployOpts } = require("./hederaDeployOpts");

/**
 * Place bets in 3 consecutive time buckets (bucket = startTimestamp-aligned window of SECONDS_PER_DAY).
 * With SECONDS_PER_DAY = 1h, buckets are hourly; bets use different shapes for settlement testing.
 *
 * Env:
 *   TORCH_ERC20_MARKET_ADDRESS (required)
 *
 * Settlement playbook (oracle price 3000 BPS):
 *   Bucket 1 — single tight bet: WINS
 *   Bucket 2 — single bet above market: LOSES
 *   Bucket 3 — batch: medium range WINS, low range LOSES
 *
 * Usage:
 *   npx hardhat run scripts/placeErc20ThreeBucketStrategyBets.js --network mainnet
 *   npx hardhat run scripts/placeErc20ThreeBucketStrategyBets.js --network testnet
 */
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];

async function main() {
  const marketAddress =
    process.env.TORCH_ERC20_MARKET_ADDRESS ||
    process.env.DEPLOYED_ERC20_MARKET_ADDRESS;
  if (!marketAddress) {
    throw new Error("Set TORCH_ERC20_MARKET_ADDRESS");
  }

  const [signer] = await ethers.getSigners();
  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    marketAddress,
    signer,
  );

  const tokenAddr = await market.collateralToken();
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);

  const block = await ethers.provider.getBlock("latest");
  const now = ethers.BigNumber.from(block.timestamp);
  const spd = await market.SECONDS_PER_DAY();
  const minAhead = await market.MIN_DAYS_AHEAD();
  const maxAhead = await market.MAX_DAYS_AHEAD();

  const minTarget = now.add(minAhead.mul(spd)).add(90);
  const maxTarget = now.add(maxAhead.mul(spd)).sub(60);
  const T1 = minTarget;
  const T2 = T1.add(spd);
  const T3 = T2.add(spd);

  if (T3.gt(maxTarget)) {
    throw new Error(
      "Third bucket exceeds MAX window; lower MIN or wait / redeploy with wider MAX",
    );
  }

  console.log("\n======== ERC20 three-bucket strategy bets ========");
  console.log("Network:", network.name);
  console.log("Market:", marketAddress);
  console.log("Token:", tokenAddr);
  console.log("Signer:", signer.address);
  console.log("SECONDS_PER_DAY (bucket width):", spd.toString(), "s");
  console.log("Oracle hint for tests: 3000 BPS\n");

  const totalNeeded = ethers.utils.parseEther("0.6");
  let al = await token.allowance(signer.address, marketAddress);
  if (al.lt(totalNeeded)) {
    console.log("Approving market (total ~0.6 tokens)...");
    const ap = await token.approve(
      marketAddress,
      ethers.constants.MaxUint256,
      deployOpts(800_000),
    );
    await ap.wait();
  }

  const nextBefore = await market.nextBetId();

  // --- Bucket 1: single placeBet, sharp-ish winner at 3000 ---
  console.log("--- Bucket 1 (single bet) ---");
  console.log("  target:", T1.toString(), "bucket:", (await market.bucketIndex(T1)).toString());
  let tx = await market.placeBet(
    T1,
    2980,
    3020,
    ethers.utils.parseEther("0.1"),
    deployOpts(900_000),
  );
  await tx.wait();
  console.log("  tx:", tx.hash, "| expect WIN @ 3000");

  // --- Bucket 2: single placeBet, clear loser at 3000 ---
  console.log("--- Bucket 2 (single bet) ---");
  console.log("  target:", T2.toString(), "bucket:", (await market.bucketIndex(T2)).toString());
  tx = await market.placeBet(
    T2,
    4100,
    4300,
    ethers.utils.parseEther("0.15"),
    deployOpts(900_000),
  );
  await tx.wait();
  console.log("  tx:", tx.hash, "| expect LOSE @ 3000");

  // --- Bucket 3: placeBatchBets — one winner, one loser ---
  console.log("--- Bucket 3 (batch 2 bets, same timestamp) ---");
  console.log("  target:", T3.toString(), "bucket:", (await market.bucketIndex(T3)).toString());
  const s1 = ethers.utils.parseEther("0.12");
  const s2 = ethers.utils.parseEther("0.08");
  tx = await market.placeBatchBets(
    [T3, T3],
    [2920, 2100],
    [3080, 2500],
    [s1, s2],
    deployOpts(2_500_000),
  );
  await tx.wait();
  console.log("  tx:", tx.hash);
  console.log("  leg A 2920-3080: WIN @ 3000 | leg B 2100-2500: LOSE @ 3000");

  const nextAfter = await market.nextBetId();
  const count = nextAfter.sub(nextBefore).toNumber();
  console.log("\n======== Summary ========");
  console.log("New bets:", count, "(betIds", nextBefore.toString(), "..", nextAfter.sub(1).toString(), ")");
  console.log("\nAfter resolution time, per target timestamp:");
  console.log(`  setPriceForTimestamp(${T1}, 3000)`);
  console.log(`  setPriceForTimestamp(${T2}, 3000)`);
  console.log(`  setPriceForTimestamp(${T3}, 3000)`);
  console.log("Then processBatch(bucket) for buckets:", (await market.bucketIndex(T1)).toString(), (await market.bucketIndex(T2)).toString(), (await market.bucketIndex(T3)).toString());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
