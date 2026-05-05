import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const FacetCutAction = { Add: 0 } as const;
const EXCLUDED_SELECTORS = new Set(["isPaused()", "isCancelled(uint256)"]);

type ContractWithInterface = {
  interface: {
    fragments: Array<{ type: string; format: (kind: string) => string; selector: string }>;
  };
};

function getSelectors(contract: ContractWithInterface, excluded: Set<string> = new Set()) {
  return contract.interface.fragments
    .filter((fragment) => fragment.type === "function")
    .filter((fragment) => !excluded.has(fragment.format("sighash")))
    .map((fragment) => fragment.selector);
}

describe("PredictionMarketDiamond", function () {
  async function deployFixture() {
    const [deployer, admin, alice, bob, creator, treasury] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy();

    const PredictionMarketDiamond = await ethers.getContractFactory("PredictionMarketDiamond");
    const diamond = await PredictionMarketDiamond.deploy(await token.getAddress(), 1000, admin.address);
    const diamondAddress = await diamond.getAddress();

    const PredictionCoreFacet = await ethers.getContractFactory("PredictionCoreFacet");
    const PredictionMarketViewFacet = await ethers.getContractFactory("PredictionMarketViewFacet");
    const ProtocolAdminFacet = await ethers.getContractFactory("ProtocolAdminFacet");
    const ProtocolSafetyFacet = await ethers.getContractFactory("ProtocolSafetyFacet");

    const coreFacet = await PredictionCoreFacet.deploy();
    const viewFacet = await PredictionMarketViewFacet.deploy();
    const adminFacet = await ProtocolAdminFacet.deploy();
    const safetyFacet = await ProtocolSafetyFacet.deploy();

    const cuts = [
      { target: await coreFacet.getAddress(), action: FacetCutAction.Add, selectors: getSelectors(coreFacet as unknown as ContractWithInterface) },
      { target: await viewFacet.getAddress(), action: FacetCutAction.Add, selectors: getSelectors(viewFacet as unknown as ContractWithInterface) },
      { target: await adminFacet.getAddress(), action: FacetCutAction.Add, selectors: getSelectors(adminFacet as unknown as ContractWithInterface) },
      {
        target: await safetyFacet.getAddress(),
        action: FacetCutAction.Add,
        selectors: getSelectors(safetyFacet as unknown as ContractWithInterface, EXCLUDED_SELECTORS),
      },
    ];

    const diamondCut = await ethers.getContractAt("IERC2535DiamondCut", diamondAddress);
    await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");

    const core = await ethers.getContractAt("PredictionCoreFacet", diamondAddress);
    const view = await ethers.getContractAt("PredictionMarketViewFacet", diamondAddress);
    const protocolAdmin = await ethers.getContractAt("ProtocolAdminFacet", diamondAddress);
    const safety = await ethers.getContractAt("ProtocolSafetyFacet", diamondAddress);

    const amount = ethers.parseUnits("1000", 18);
    await token.mint(alice.address, amount);
    await token.mint(bob.address, amount);
    await token.connect(alice).approve(diamondAddress, amount);
    await token.connect(bob).approve(diamondAddress, amount);

    return { deployer, admin, alice, bob, creator, treasury, token, core, view, protocolAdmin, safety };
  }

  async function createMarket(core: Awaited<ReturnType<typeof ethers.getContractAt>>, admin: Awaited<ReturnType<typeof ethers.getSigners>>[number], creator: string = ethers.ZeroAddress, creatorFeeBps = 0) {
    const options = [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ];
    const closeTime = (await time.latest()) + 3600;

    if (creator === ethers.ZeroAddress) {
      await core.connect(admin).createMarket("game-1", "Will it happen?", "general", closeTime, options);
    } else {
      await core.connect(admin).createMarketWithCreator("game-1", "Will it happen?", "general", closeTime, options, creator, creatorFeeBps);
    }
  }

  it("creates markets through the prediction core facet", async function () {
    const { admin, core, view } = await deployFixture();

    await createMarket(core, admin);

    expect(await view.getNextMarketId()).to.equal(1);
    const market = await view.getMarket(0);
    expect(market.gameId).to.equal("game-1");
    expect(market.optionCount).to.equal(2);
  });

  it("escrows predictions, resolves markets, pays winners, and accounts fees", async function () {
    const { admin, alice, bob, treasury, token, core, protocolAdmin } = await deployFixture();

    await createMarket(core, admin);
    const alicePredictionId = ethers.id("alice-yes");
    const bobPredictionId = ethers.id("bob-no");
    const stake = ethers.parseUnits("100", 18);

    await core.connect(alice).placePrediction(alicePredictionId, 0, 0, stake);
    await core.connect(bob).placePrediction(bobPredictionId, 0, 1, stake);

    await core.connect(admin).finalizePredictionOutcome(ethers.id("settlement-1"), 0, 0);

    await expect(core.connect(alice).claimPrediction(alicePredictionId)).to.changeTokenBalances(token, [alice], [ethers.parseUnits("190", 18)]);

    await core.connect(bob).claimPrediction(bobPredictionId);
    expect(await protocolAdmin.accumulatedFees()).to.equal(ethers.parseUnits("10", 18));

    await expect(protocolAdmin.connect(admin).withdrawFees(treasury.address, ethers.parseUnits("10", 18))).to.changeTokenBalances(
      token,
      [treasury],
      [ethers.parseUnits("10", 18)]
    );
  });

  it("lets users refund predictions after admin cancels a market", async function () {
    const { admin, alice, token, core, safety } = await deployFixture();

    await createMarket(core, admin);
    const predictionId = ethers.id("alice-cancelled");
    const stake = ethers.parseUnits("25", 18);

    await core.connect(alice).placePrediction(predictionId, 0, 0, stake);
    await safety.connect(admin).cancelMarket(0);

    await expect(core.connect(alice).voidPrediction(predictionId)).to.changeTokenBalances(token, [alice], [stake]);
  });

  it("enforces market close timestamp for new predictions", async function () {
    const { admin, alice, core, view } = await deployFixture();
    const options = [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ];
    const closeTime = (await time.latest()) + 10;
    await core.connect(admin).createMarket("game-1", "Will it happen?", "general", closeTime, options);

    await time.increaseTo(closeTime);

    await expect(core.connect(alice).placePrediction(ethers.id("late-prediction"), await view.getLatestMarketId(), 0, ethers.parseUnits("1", 18))).to.be.revertedWith(
      "MARKET_ENTRY_CLOSED"
    );
  });

  it("lets admin extend market close time", async function () {
    const { admin, alice, core, protocolAdmin, view } = await deployFixture();
    const options = [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ];
    const initialCloseTime = (await time.latest()) + 30;
    await core.connect(admin).createMarket("game-1", "Will it happen?", "general", initialCloseTime, options);

    const extendedCloseTime = initialCloseTime + 3600;
    await protocolAdmin.connect(admin).extendMarketCloseTime(0, extendedCloseTime);

    const market = await view.getMarket(0);
    expect(market.closeTime).to.equal(extendedCloseTime);

    await expect(protocolAdmin.connect(alice).extendMarketCloseTime(0, extendedCloseTime + 10)).to.be.revertedWith("NOT_ADMIN");
  });
});
