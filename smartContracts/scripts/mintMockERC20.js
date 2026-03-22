const { ethers } = require("hardhat");

/**
 * Mint MockERC20 to an address (only works for deployed MockERC20).
 */
module.exports = async (tokenAddress, recipientAddress, amountHuman) => {
  const [signer] = await ethers.getSigners();
  const token = await ethers.getContractAt("MockERC20", tokenAddress, signer);

  const amount = ethers.utils.parseEther(amountHuman.toString());

  console.log(`Minting ${amountHuman} MCOL to ${recipientAddress}...`);
  const tx = await token.mint(recipientAddress, amount);
  await tx.wait();
  console.log("✅ Mint done:", tx.hash);
  return tx.hash;
};
