const { ethers, network } = require("hardhat");
const { deployOpts } = require("./hederaDeployOpts");

/**
 * Deploy MockERC20 (test collateral with public mint).
 * @returns {Promise<string>} token contract address
 */
module.exports = async () => {
  const [wallet] = await ethers.getSigners();

  console.log("Deploying MockERC20...");
  console.log("Deployer:", wallet.address);

  const MockERC20 = await ethers.getContractFactory("MockERC20", wallet);
  const token = await MockERC20.deploy(deployOpts(3_000_000));
  await token.deployed();

  const receipt = await token.deployTransaction.wait();
  const contractAddress = receipt.contractAddress || token.address;

  console.log("✅ MockERC20 deployed");
  console.log(`📍 Token: ${contractAddress}`);
  console.log(`🔗 Network: ${network.name}`);
  console.log(`📝 Tx: ${receipt.transactionHash}`);

  return contractAddress;
};
