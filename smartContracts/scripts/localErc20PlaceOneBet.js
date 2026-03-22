/**
 * Local demo: same mental steps as classic Torch, but collateral is ERC20.
 *
 * Classic:  deploy TorchPredictionMarket → placeBet({ value })
 * ERC20:    deploy MockERC20 → deploy TorchPredictionMarketERC20(token) → approve → placeBet(stakeAmount)
 *
 * Usage (single-shot ephemeral chain):
 *   npx hardhat run scripts/localErc20PlaceOneBet.js --network hardhat
 *
 * Usage (persistent chain — run in another terminal first: npx hardhat node):
 *   npx hardhat run scripts/localErc20PlaceOneBet.js --network localhost
 */
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n========== Step 1: Deploy ERC20 (test collateral) ==========");
  const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
  const token = await MockERC20.deploy();
  await token.deployed();
  console.log("MockERC20 (MCOL):", token.address);

  console.log("\n========== Step 2: Deploy TorchPredictionMarketERC20 ==========");
  const Market = await ethers.getContractFactory(
    "TorchPredictionMarketERC20",
    deployer,
  );
  const market = await Market.deploy(token.address);
  await market.deployed();
  console.log("Market:", market.address);
  console.log("Owner:", await market.owner());

  console.log("\n========== Step 3: Fund deployer with MCOL (mint) ==========");
  const mintAmount = ethers.utils.parseEther("1000");
  await (await token.mint(deployer.address, mintAmount)).wait();
  console.log("Minted", ethers.utils.formatEther(mintAmount), "MCOL to", deployer.address);

  console.log("\n========== Step 4: Approve market + placeBet (one tx path) ==========");
  const block = await ethers.provider.getBlock("latest");
  const SECONDS_PER_DAY = 24 * 60 * 60;
  const targetTimestamp = block.timestamp + SECONDS_PER_DAY + 3600;
  const stakeGross = ethers.utils.parseEther("1");

  await (await token.approve(market.address, stakeGross)).wait();
  console.log("Approved market to pull", ethers.utils.formatEther(stakeGross), "MCOL");

  const tx = await market.placeBet(targetTimestamp, 2900, 3100, stakeGross);
  const receipt = await tx.wait();
  console.log("placeBet tx:", receipt.transactionHash);

  const betId = (await market.nextBetId()).sub(1);
  const bet = await market.getBet(betId);
  console.log("\n========== Result ==========");
  console.log("betId:", betId.toString());
  console.log("bettor:", bet.bettor);
  console.log("targetTimestamp:", bet.targetTimestamp.toString());
  console.log("stake (net after fee):", ethers.utils.formatEther(bet.stake), "MCOL units");
  console.log("weight:", bet.weight.toString());

  console.log("\n--- Same as classic torch (economics) ---");
  console.log("Tests compare this market to TorchPredictionMarket in:");
  console.log("  test/TorchPredictionMarketERC20.test.js --network hardhat");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
