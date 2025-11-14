const { ethers, network } = require("hardhat");

module.exports = async () => {
  // Assign the first signer, which comes from the first privateKey from our configuration in hardhat.config.js, to a wallet variable.
  let wallet = (await ethers.getSigners())[0];

  console.log("Deploying TorchPredictionMarket contract...");
  console.log("Deployer address:", wallet.address);

  // Initialize a contract factory object
  // name of contract as first parameter
  // wallet/signer used for signing the contract calls/transactions with this contract
  const TorchPredictionMarket = await ethers.getContractFactory(
    "TorchPredictionMarket",
    wallet,
  );

  // Using already initialized contract factory object with our contract, we can invoke deploy function to deploy the contract.
  // No constructor parameters needed for TorchPredictionMarket
  console.log("🚀 Deploying contract...");
  const predictionMarket = await TorchPredictionMarket.deploy();

  console.log("⏳ Waiting for deployment transaction...");
  // We use wait to receive the transaction (deployment) receipt, which contains contractAddress
  const receipt = await predictionMarket.deployTransaction.wait();
  const contractAddress = receipt.contractAddress || predictionMarket.address;

  console.log("✅ TorchPredictionMarket deployed successfully!");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`🔗 Network: ${network.name}`);
  console.log(`👤 Deployer: ${wallet.address}`);
  console.log(`📝 Transaction Hash: ${receipt.transactionHash}`);
  console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);

  // Log some initial contract state
  try {
    const startTimestamp = await predictionMarket.startTimestamp();
    const nextBetId = await predictionMarket.nextBetId();
    const owner = await predictionMarket.owner();
    console.log(`\n📊 Initial Contract State:`);
    console.log(`  🆔 Next Bet ID: ${nextBetId}`);
    console.log(`  📅 Start Timestamp: ${startTimestamp}`);
    console.log(`  👑 Owner: ${owner}`);
  } catch (error) {
    console.log(
      "⚠️ Could not read contract state immediately (this is normal on Hedera)",
    );
  }

  return contractAddress;
}; 