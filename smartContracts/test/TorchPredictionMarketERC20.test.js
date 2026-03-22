const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Local (default in-process chain):
 *   npx hardhat test test/TorchPredictionMarketERC20.test.js --network hardhat
 *
 * Hedera (testnet / local node) — set TESTNET_ENDPOINT + TESTNET_OPERATOR_PRIVATE_KEY (or LOCAL_*):
 *   npx hardhat test test/TorchPredictionMarketERC20.test.js --network testnet
 * Only one funded key in `hardhat.config` is OK: extra EOAs are created and sent HBAR for gas.
 */
describe("TorchPredictionMarketERC20 (vs native TorchPredictionMarket)", function () {
  let token;
  let marketEth;
  let marketErc20;
  let owner, user1, user2, user3;

  const mintAmount = ethers.utils.parseEther("10000");

  /**
   * Timestamp valid for both markets (native uses 24h buckets, ERC20 may use 1h buckets).
   */
  async function validTargetForBoth(blockTimestamp) {
    const t = ethers.BigNumber.from(blockTimestamp);
    const minE = (await marketEth.MIN_DAYS_AHEAD())
      .mul(await marketEth.SECONDS_PER_DAY())
      .add(t);
    const minR = (await marketErc20.MIN_DAYS_AHEAD())
      .mul(await marketErc20.SECONDS_PER_DAY())
      .add(t);
    const minT = minE.gt(minR) ? minE : minR;
    const maxE = (await marketEth.MAX_DAYS_AHEAD())
      .mul(await marketEth.SECONDS_PER_DAY())
      .add(t);
    const maxR = (await marketErc20.MAX_DAYS_AHEAD())
      .mul(await marketErc20.SECONDS_PER_DAY())
      .add(t);
    const maxT = maxE.lt(maxR) ? maxE : maxR;
    if (minT.gte(maxT)) {
      throw new Error("No overlapping target window between ETH and ERC20 market constants");
    }
    return minT.add(maxT.sub(minT).div(3));
  }

  /** Hedera configs often expose a single signer; create EOAs and fund them for gas. */
  async function setupSigners() {
    const signers = await ethers.getSigners();
    owner = signers[0];
    if (signers.length >= 4) {
      user1 = signers[1];
      user2 = signers[2];
      user3 = signers[3];
      return;
    }
    const provider = ethers.provider;
    const gasFund = ethers.utils.parseEther("10");
    user1 = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
    user2 = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
    user3 = new ethers.Wallet(ethers.utils.randomBytes(32), provider);
    for (const w of [user1, user2, user3]) {
      await (await owner.sendTransaction({ to: w.address, value: gasFund })).wait();
    }
  }

  async function deployPair() {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy();
    await token.deployed();

    const TorchEth = await ethers.getContractFactory("TorchPredictionMarket");
    const TorchErc20 = await ethers.getContractFactory("TorchPredictionMarketERC20");

    // Same block: aligned startTimestamp → same bucket indices for identical targets
    marketEth = await TorchEth.deploy();
    marketErc20 = await TorchErc20.deploy(token.address);
    await marketEth.deployed();
    await marketErc20.deployed();

    for (const u of [user1, user2, user3, owner]) {
      await token.mint(u.address, mintAmount);
    }
  }

  beforeEach(async function () {
    await setupSigners();
    await deployPair();
  });

  it("matches native market bet economics (stake, weight, quality, fee) for identical inputs", async function () {
    const spdE = await marketEth.SECONDS_PER_DAY();
    const spdR = await marketErc20.SECONDS_PER_DAY();
    if (!spdE.eq(spdR)) {
      this.skip();
    }
    const block = await ethers.provider.getBlock("latest");
    const futureTimestamp = (await validTargetForBoth(block.timestamp)).toNumber();
    const betAmount = ethers.utils.parseEther("1.0");
    const priceMin = 2900;
    const priceMax = 3100;

    await marketEth.connect(user1).placeBet(futureTimestamp, priceMin, priceMax, {
      value: betAmount,
    });
    await token.connect(user1).approve(marketErc20.address, betAmount);
    await marketErc20
      .connect(user1)
      .placeBet(futureTimestamp, priceMin, priceMax, betAmount);

    const betEth = await marketEth.getBet(0);
    const betErc = await marketErc20.getBet(0);

    expect(betErc.bettor).to.equal(user1.address);
    expect(betErc.stake).to.equal(betEth.stake);
    expect(betErc.weight).to.equal(betEth.weight);
    expect(betErc.qualityBps).to.equal(betEth.qualityBps);
    expect(betErc.priceMin).to.equal(betEth.priceMin);
    expect(betErc.priceMax).to.equal(betEth.priceMax);
    expect(betErc.targetTimestamp).to.equal(betEth.targetTimestamp);

    expect(await marketErc20.totalFeesCollected()).to.equal(
      await marketEth.totalFeesCollected()
    );

    const bucketEth = await marketEth.bucketIndex(futureTimestamp);
    const bucketErc = await marketErc20.bucketIndex(futureTimestamp);
    expect(bucketErc).to.equal(bucketEth);
  });

  it("simulatePlaceBet matches between ERC20 and native markets", async function () {
    const spdE = await marketEth.SECONDS_PER_DAY();
    const spdR = await marketErc20.SECONDS_PER_DAY();
    if (!spdE.eq(spdR)) {
      this.skip();
    }
    const block = await ethers.provider.getBlock("latest");
    const futureTimestamp = (await validTargetForBoth(block.timestamp)).toNumber();
    const stakeAmount = ethers.utils.parseEther("1.0");

    const simEth = await marketEth.simulatePlaceBet(
      futureTimestamp,
      2900,
      3100,
      stakeAmount
    );
    const simErc = await marketErc20.simulatePlaceBet(
      futureTimestamp,
      2900,
      3100,
      stakeAmount
    );

    expect(simErc.isValid).to.equal(true);
    expect(simErc.fee).to.equal(simEth.fee);
    expect(simErc.stakeNet).to.equal(simEth.stakeNet);
    expect(simErc.qualityBps).to.equal(simEth.qualityBps);
    expect(simErc.weight).to.equal(simEth.weight);
    expect(simErc.bucket).to.equal(simEth.bucket);
  });

  it("full flow: 3 users, 2 win / 1 loses — payouts in ERC20 match weight formula", async function () {
    const betAmount = ethers.utils.parseEther("1.0");
    const block = await ethers.provider.getBlock("latest");
    const futureTimestamp = (await validTargetForBoth(block.timestamp)).toNumber();

    const approveAll = (u) =>
      token.connect(u).approve(marketErc20.address, ethers.constants.MaxUint256);

    await approveAll(user1);
    await marketErc20
      .connect(user1)
      .placeBet(futureTimestamp, 2900, 3100, betAmount);
    await approveAll(user2);
    await marketErc20
      .connect(user2)
      .placeBet(futureTimestamp, 2800, 3200, betAmount);
    await approveAll(user3);
    await marketErc20
      .connect(user3)
      .placeBet(futureTimestamp, 3500, 3700, betAmount);

    const bucket = await marketErc20.bucketIndex(futureTimestamp);
    expect((await marketErc20.getBucketInfo(bucket)).totalBets).to.equal(3);

    // processBatch does not require wall-clock or simulated time past targetTimestamp.
    const actualPrice = 3000;
    await marketErc20
      .connect(owner)
      .setPriceForTimestamp(futureTimestamp, actualPrice);

    await marketErc20.processBatch(bucket);
    const bucketInfo = await marketErc20.getBucketInfo(bucket);
    expect(bucketInfo.aggregationComplete).to.be.true;

    const b1 = await marketErc20.getBet(0);
    const b2 = await marketErc20.getBet(1);
    const b3 = await marketErc20.getBet(2);
    expect(b1.won).to.be.true;
    expect(b2.won).to.be.true;
    expect(b3.won).to.be.false;

    const stats = await marketErc20.getBucketStats(bucket);
    const totalStaked = stats.totalStaked;
    const tw = bucketInfo.totalWinningWeight;
    const expected1 = b1.weight.mul(totalStaked).div(tw);
    const expected2 = b2.weight.mul(totalStaked).div(tw);

    const bal1Before = await token.balanceOf(user1.address);
    const bal2Before = await token.balanceOf(user2.address);
    const bal3Before = await token.balanceOf(user3.address);

    await marketErc20.connect(user1).claimBet(0);
    await marketErc20.connect(user2).claimBet(1);
    await marketErc20.connect(user3).claimBet(2);

    expect(await token.balanceOf(user1.address)).to.equal(
      bal1Before.add(expected1)
    );
    expect(await token.balanceOf(user2.address)).to.equal(
      bal2Before.add(expected2)
    );
    expect(await token.balanceOf(user3.address)).to.equal(bal3Before);

    expect((await marketErc20.getBet(0)).claimed).to.be.true;
    expect((await marketErc20.getBet(1)).claimed).to.be.true;
    expect((await marketErc20.getBet(2)).claimed).to.be.true;
  });

  it("placeBatchBets pulls once and matches per-bet economics vs native batch + ETH", async function () {
    const spdE = await marketEth.SECONDS_PER_DAY();
    const spdR = await marketErc20.SECONDS_PER_DAY();
    if (!spdE.eq(spdR)) {
      this.skip();
    }
    const block = await ethers.provider.getBlock("latest");
    const t0 = (await validTargetForBoth(block.timestamp)).toNumber();
    const t1 = t0 + spdE.toNumber();
    const a0 = ethers.utils.parseEther("0.5");
    const a1 = ethers.utils.parseEther("0.75");

    await marketEth.connect(user1).placeBatchBets(
      [t0, t1],
      [1000, 2000],
      [1100, 2100],
      [a0, a1],
      { value: a0.add(a1) }
    );

    await token.connect(user2).approve(marketErc20.address, a0.add(a1));
    await marketErc20.connect(user2).placeBatchBets(
      [t0, t1],
      [1000, 2000],
      [1100, 2100],
      [a0, a1]
    );

    // price ranges above: first bet 1000-1100, second 2000-2100 (same widths as native)
    const betEth0 = await marketEth.getBet(0);
    const betErc0 = await marketErc20.getBet(0);
    expect(betErc0.stake).to.equal(betEth0.stake);
    expect(betErc0.weight).to.equal(betEth0.weight);

    const betEth1 = await marketEth.getBet(1);
    const betErc1 = await marketErc20.getBet(1);
    expect(betErc1.stake).to.equal(betEth1.stake);
    expect(betErc1.weight).to.equal(betEth1.weight);
  });

  it("withdrawFees sends accumulated fees in tokens to owner", async function () {
    const block = await ethers.provider.getBlock("latest");
    const futureTimestamp = (await validTargetForBoth(block.timestamp)).toNumber();
    const betAmount = ethers.utils.parseEther("10");

    await token.connect(user1).approve(marketErc20.address, betAmount);
    await marketErc20
      .connect(user1)
      .placeBet(futureTimestamp, 100, 200, betAmount);

    const fees = await marketErc20.totalFeesCollected();
    expect(fees.gt(0)).to.be.true;

    const before = await token.balanceOf(owner.address);
    await marketErc20.connect(owner).withdrawFees();
    expect(await token.balanceOf(owner.address)).to.equal(before.add(fees));
    expect(await marketErc20.totalFeesCollected()).to.equal(0);
  });

  it("reverts on plain ETH receive", async function () {
    await expect(
      owner.sendTransaction({
        to: marketErc20.address,
        value: ethers.utils.parseEther("1"),
      })
    ).to.be.revertedWith("ETH not accepted");
  });
});
