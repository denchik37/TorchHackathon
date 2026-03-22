const { ethers, network } = require("hardhat");
const { deployOpts } = require("./hederaDeployOpts");

/**
 * Deploy TorchPredictionMarketERC20 with a collateral ERC20 address.
 * @param {string} [collateralTokenAddress] – or set COLLATERAL_TOKEN_ADDRESS in .env
 * @returns {Promise<string>} market contract address
 */
module.exports = async (collateralTokenAddress) => {
  const token =
    collateralTokenAddress || process.env.COLLATERAL_TOKEN_ADDRESS;
  if (!token) {
    throw new Error(
      "Pass collateral token address or set COLLATERAL_TOKEN_ADDRESS",
    );
  }

  const [wallet] = await ethers.getSigners();

  console.log("Deploying TorchPredictionMarketERC20...");
  console.log("Deployer:", wallet.address);
  console.log("Collateral token:", token);

  const Factory = await ethers.getContractFactory(
    "TorchPredictionMarketERC20",
    wallet,
  );
  // Cap below ~7 HBAR max fee at ~990 gwei (10M * 990 gwei exceeds many operator balances)
  const marketGas =
    process.env.HEDERA_MARKET_DEPLOY_GAS != null
      ? Number(process.env.HEDERA_MARKET_DEPLOY_GAS)
      : 5_500_000;
  const market = await Factory.deploy(token, deployOpts(marketGas));
  await market.deployed();

  const receipt = await market.deployTransaction.wait();
  const contractAddress = receipt.contractAddress || market.address;

  console.log("✅ TorchPredictionMarketERC20 deployed");
  console.log(`📍 Market: ${contractAddress}`);
  console.log(`🔗 Network: ${network.name}`);
  console.log(`📝 Tx: ${receipt.transactionHash}`);

  try {
    const owner = await market.owner();
    const nextBetId = await market.nextBetId();
    console.log(`\n📊 Owner: ${owner} | nextBetId: ${nextBetId}`);
  } catch (e) {
    console.log("⚠️ Could not read initial state:", e.message);
  }

  return contractAddress;
};
