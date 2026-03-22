const { ethers } = require("hardhat");

module.exports = async (contractAddress, newOwnerAddress) => {
  console.log("🔄 transferOwnership (TorchPredictionMarketERC20)");

  const [currentOwner] = await ethers.getSigners();

  if (!ethers.utils.isAddress(newOwnerAddress)) {
    throw new Error(`Invalid address: ${newOwnerAddress}`);
  }

  const Factory = await ethers.getContractFactory("TorchPredictionMarketERC20");
  const contract = Factory.attach(contractAddress);

  const tx = await contract.connect(currentOwner).transferOwnership(newOwnerAddress);
  await tx.wait();
  console.log("✅ Ownership transferred | tx:", tx.hash);
  console.log("   New owner:", await contract.owner());
  return tx.hash;
};
