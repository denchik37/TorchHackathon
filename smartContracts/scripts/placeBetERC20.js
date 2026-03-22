const { ethers } = require("hardhat");
const { deployOpts } = require("./hederaDeployOpts");

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

function parseStake(stakeAmount) {
  const s = String(stakeAmount).trim();
  if (/^\d+$/.test(s)) {
    return ethers.BigNumber.from(s);
  }
  return ethers.utils.parseEther(s);
}

/**
 * Approve market (if needed) and placeBet on TorchPredictionMarketERC20.
 * stakeAmount: wei as integer string, or ether like "0.1"
 */
module.exports = async (
  contractAddress,
  targetTimestamp,
  priceMin,
  priceMax,
  stakeAmount,
) => {
  const [signer] = await ethers.getSigners();

  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    contractAddress,
    signer,
  );

  const tokenAddr = await market.collateralToken();
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);

  const stakeBn = parseStake(stakeAmount);

  console.log("🎲 placeBet (ERC20)");
  console.log(`   Market: ${contractAddress}`);
  console.log(`   Token: ${tokenAddr}`);
  console.log(`   Stake (gross): ${ethers.utils.formatEther(stakeBn)} tokens`);

  const cur = await token.allowance(signer.address, contractAddress);
  if (cur.lt(stakeBn)) {
    console.log("   Approving market...");
    const approveTx = await token.approve(
      contractAddress,
      stakeBn,
      deployOpts(800_000),
    );
    await approveTx.wait();
  }

  const tx = await market.placeBet(
    targetTimestamp,
    Number(priceMin),
    Number(priceMax),
    stakeBn,
    deployOpts(900_000),
  );
  console.log("⏳ Tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Bet placed | gas:", receipt.gasUsed.toString());

  const betId = (await market.nextBetId()).sub(1);
  console.log(`   betId: ${betId.toString()}`);
  return { txHash: tx.hash, betId: betId.toString() };
};
