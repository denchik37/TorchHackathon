const { ethers } = require("hardhat");
const deployMockERC20 = require("./deployMockERC20");
const deployTorchPredictionMarketERC20 = require("./deployTorchPredictionMarketERC20");
const { deployOpts } = require("./hederaDeployOpts");

/**
 * Deploy MockERC20 + TorchPredictionMarketERC20 and mint MCOL to deployer for testing.
 * Optional: STACK_MINT_DEPLOYER (wei, default 1e24) in .env
 */
module.exports = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 Deploy ERC20 collateral + TorchPredictionMarketERC20");
  console.log("=".repeat(60));

  const tokenAddress = await deployMockERC20();
  const marketAddress = await deployTorchPredictionMarketERC20(tokenAddress);

  const [deployer] = await ethers.getSigners();
  const token = await ethers.getContractAt("MockERC20", tokenAddress, deployer);

  const mintAmt = process.env.STACK_MINT_DEPLOYER
    ? ethers.BigNumber.from(process.env.STACK_MINT_DEPLOYER)
    : ethers.utils.parseEther("1000000");

  console.log("\n💰 Minting MCOL to deployer...");
  const mintTx = await token.mint(deployer.address, mintAmt, deployOpts(500_000));
  await mintTx.wait();
  console.log(`   Minted: ${ethers.utils.formatEther(mintAmt)} MCOL → ${deployer.address}`);

  console.log("\n📋 Add to .env (example):");
  console.log(`COLLATERAL_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`TORCH_ERC20_MARKET_ADDRESS=${marketAddress}`);

  return { tokenAddress, marketAddress };
};
