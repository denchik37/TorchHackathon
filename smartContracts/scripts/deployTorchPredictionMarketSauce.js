const { ethers, network } = require("hardhat");

module.exports = async () => {
  const wallet = (await ethers.getSigners())[0];

  const stakeTokenAddress =
    process.env.SAUCE_TOKEN_ADDRESS || process.env.STAKE_TOKEN_ADDRESS;

  if (!stakeTokenAddress) {
    throw new Error(
      "Missing token address. Set SAUCE_TOKEN_ADDRESS (or STAKE_TOKEN_ADDRESS) in your environment."
    );
  }

  console.log("Deploying TorchPredictionMarketSauce contract...");
  console.log("Deployer address:", wallet.address);
  console.log("Stake token address:", stakeTokenAddress);
  console.log("Network:", network.name);

  const TorchPredictionMarketSauce = await ethers.getContractFactory(
    "TorchPredictionMarketSauce",
    wallet
  );

  console.log("🚀 Deploying contract...");
  const predictionMarket = await TorchPredictionMarketSauce.deploy(
    stakeTokenAddress
  );

  console.log("⏳ Waiting for deployment transaction...");
  const receipt = await predictionMarket.deployTransaction.wait();
  const contractAddress =
    receipt.contractAddress || predictionMarket.address;

  console.log("✅ TorchPredictionMarketSauce deployed successfully!");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`👤 Deployer: ${wallet.address}`);
  console.log(`📝 Transaction Hash: ${receipt.transactionHash}`);
  console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

  try {
    const nextBetId = await predictionMarket.nextBetId();
    const startTimestamp = await predictionMarket.startTimestamp();
    const tokenDecimals = await predictionMarket.stakeTokenDecimals();
    console.log(`\n📊 Initial Contract State:`);
    console.log(`  🆔 Next Bet ID: ${nextBetId}`);
    console.log(`  📅 Start Timestamp: ${startTimestamp.toString()}`);
    console.log(`  🔢 Stake Token Decimals: ${tokenDecimals.toString()}`);
    console.log(`  💵 minStake: ${(
      await predictionMarket.minStake()
    ).toString()}`);
    console.log(`  💵 maxStake: ${(
      await predictionMarket.maxStake()
    ).toString()}`);
  } catch (e) {
    console.log("⚠️ Could not read initial contract state (Hedera may lag).");
  }

  return contractAddress;
};

