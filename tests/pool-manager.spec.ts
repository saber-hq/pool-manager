/// <reference types="mocha" />

import { assertTXSuccess, expectTX } from "@saberhq/chai-solana";
import { TransactionEnvelope } from "@saberhq/solana-contrib";
import {
  decodeSwap,
  DEFAULT_TOKEN_DECIMALS,
  loadProgramAccount,
  RECOMMENDED_FEES,
  StableSwap,
  SWAP_PROGRAM_ID,
} from "@saberhq/stableswap-sdk";
import {
  createMintToInstruction,
  getATAAddresses,
  getTokenAccount,
  u64,
} from "@saberhq/token-utils";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import invariant from "tiny-invariant";

import { MIN_RAMP_DURATION } from "../src/constants";
import { findSaberPool, findSaberPoolManager } from "../src/pda";
import { comparePubkeys } from "../src/utils/comparePubkeys";
import type { PoolManagerWrapper } from "../src/wrappers/poolManager";
import { createPool, makePoolManagerSDK } from "./testutils";

describe("Saber Pool Manager", () => {
  const sdk = makePoolManagerSDK();
  const { provider } = sdk;
  const admin = Keypair.generate();
  const minter = Keypair.generate();
  const initialAmpFactor = new u64(100);

  let pmWrapper: PoolManagerWrapper;
  let swapAccount: PublicKey;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let mintLP: PublicKey;

  beforeEach(async () => {
    const { tx, wrapper } = await sdk.newManager({ admin: admin.publicKey });
    await assertTXSuccess(tx, "Create new manager");

    await expectTX(
      provider.withSigner(admin).requestAirdrop(100 * LAMPORTS_PER_SOL)
    ).to.be.fulfilled;

    const createPoolResults = await createPool(
      provider,
      minter,
      wrapper,
      initialAmpFactor
    );

    mintA = createPoolResults.mintA;
    mintB = createPoolResults.mintB;
    mintLP = createPoolResults.mintLP;
    pmWrapper = wrapper;
    swapAccount = createPoolResults.swapAccount;
  });

  it("Pool Manager was created", async () => {
    await pmWrapper.reloadData();
    const { key, data } = pmWrapper;
    invariant(data, "pool manager data must exist");

    const [expectedKey, expectedBump] = await findSaberPoolManager(data.base);
    expect(data.bump).to.equal(expectedBump);
    expect(data.admin).eqAddress(admin.publicKey);
    expect(data.pendingAdmin).eqAddress(PublicKey.default);
    expect(data.numPools.toString()).to.equal("1");
    expect(key).eqAddress(expectedKey);
  });

  it("Pool was created", async () => {
    const [poolKey, bump] = await findSaberPool(pmWrapper.key, mintA, mintB);
    const data = await pmWrapper.loadPool(poolKey);
    invariant(data, "pool manager data must exist");

    const [expectedMintA, expectedMintB] =
      comparePubkeys(mintA, mintB) !== -1 ? [mintB, mintA] : [mintA, mintB];
    expect(data.bump).to.equal(bump);
    expect(data.index.toString()).to.equal("0");
    expect(data.manager).eqAddress(pmWrapper.key);
    expect(data.mintA).eqAddress(expectedMintA);
    expect(data.mintB).eqAddress(expectedMintB);
    expect(data.swap).eqAddress(swapAccount);
    expect(data.lpMint).eqAddress(mintLP);
    expect(data.tokenDecimals).equal(DEFAULT_TOKEN_DECIMALS);
    expect(data.permissionlessImport).to.be.true;
  });

  it("Ramp amplication coefficient, then stop", async () => {
    const poolWrapper = await pmWrapper
      .withSigner(admin)
      .loadPoolWrapperFromMints(mintA, mintB);

    async function getInitialAndTargetAmpFactors() {
      const swap = await StableSwap.load(
        sdk.provider.connection,
        poolWrapper.data.swap
      );
      return [
        swap.state.initialAmpFactor.toString(),
        swap.state.targetAmpFactor.toString(),
      ];
    }

    let ampFactors = await getInitialAndTargetAmpFactors();
    expect(ampFactors[0]).to.equal(initialAmpFactor.toString());
    expect(ampFactors[1]).to.equal(initialAmpFactor.toString());

    // Ramp
    const newAmpFactor = new u64(200);
    const rampTx = poolWrapper.rampA(
      newAmpFactor,
      Math.floor(Date.now() / 1_000 + MIN_RAMP_DURATION)
    );
    await expectTX(rampTx, "Ramp amplication coefficient").to.be.fulfilled;

    ampFactors = await getInitialAndTargetAmpFactors();
    expect(ampFactors[0]).to.equal(initialAmpFactor.toString());
    expect(ampFactors[1]).to.equal(newAmpFactor.toString());

    // Stop ramping
    const stopRampTx = poolWrapper.stopRampA();
    await expectTX(stopRampTx, "Stop ramping amplication coefficient").to.be
      .fulfilled;
    ampFactors = await getInitialAndTargetAmpFactors();
    expect(ampFactors[0]).to.equal(initialAmpFactor.toString());
    expect(ampFactors[1]).to.equal(initialAmpFactor.toString());
  });

  it("Pause swap, then unpause", async () => {
    const poolWrapper = await pmWrapper
      .withSigner(admin)
      .loadPoolWrapperFromMints(mintA, mintB);

    async function getIsPaused() {
      const dataSwap = await loadProgramAccount(
        sdk.provider.connection,
        swapAccount,
        SWAP_PROGRAM_ID
      );
      const dataSwapDecoded = decodeSwap(dataSwap);
      // this actually returns 0/1 but javascript lets us do this instead
      return !!dataSwapDecoded.isPaused;
    }

    // Initially, swap should not be paused.
    expect(await getIsPaused()).to.equal(false);

    const pauseTx = poolWrapper.pauseSwap();
    await expectTX(pauseTx, "Pause swap").to.be.fulfilled;
    // Check that pausing works.
    expect(await getIsPaused()).to.equal(true);

    const unpauseTx = poolWrapper.unpauseSwap();
    await expectTX(unpauseTx, "Unpause swap").to.be.fulfilled;
    // Check that unpausing works.
    expect(await getIsPaused()).to.equal(false);
  });

  it("Commit and apply new admin", async () => {
    const poolWrapper = await pmWrapper
      .withSigner(admin)
      .loadPoolWrapperFromMints(mintA, mintB);

    async function getSwapAdmin() {
      const swap = await StableSwap.load(
        sdk.provider.connection,
        poolWrapper.data.swap
      );
      return swap.state.adminAccount.toString();
    }

    expect(await getSwapAdmin()).to.equal(poolWrapper.key.toString());

    const newAdmin = new Keypair();
    const commitNewAdminTx = poolWrapper.commitNewAdmin(newAdmin.publicKey);
    await expectTX(commitNewAdminTx, "Commit new admin").to.be.fulfilled;

    const applyNewAdminTx = poolWrapper.applyNewAdmin();
    await expectTX(applyNewAdminTx, "Apply new admin").to.be.fulfilled;

    expect(await getSwapAdmin()).to.equal(newAdmin.publicKey.toString());
  });

  it("Set new fees", async () => {
    const poolWrapper = await pmWrapper
      .withSigner(admin)
      .loadPoolWrapperFromMints(mintA, mintB);

    async function getFees() {
      const swap = await StableSwap.load(
        sdk.provider.connection,
        poolWrapper.data.swap
      );
      return swap.state.fees;
    }

    const setNewFeesTx = poolWrapper.setNewFees(RECOMMENDED_FEES);
    await expectTX(setNewFeesTx, "Set new fees").to.be.fulfilled;

    const newFees = await getFees();
    expect(newFees.adminTrade.numerator.toString()).to.equal(
      RECOMMENDED_FEES.adminTrade.numerator.toString()
    );
    expect(newFees.adminWithdraw.numerator.toString()).to.equal(
      RECOMMENDED_FEES.adminWithdraw.numerator.toString()
    );
    expect(newFees.trade.numerator.toString()).to.equal(
      RECOMMENDED_FEES.trade.numerator.toString()
    );
    expect(newFees.withdraw.numerator.toString()).to.equal(
      RECOMMENDED_FEES.withdraw.numerator.toString()
    );

    expect(newFees.adminTrade.denominator.toString()).to.equal(
      RECOMMENDED_FEES.adminTrade.denominator.toString()
    );
    expect(newFees.adminWithdraw.denominator.toString()).to.equal(
      RECOMMENDED_FEES.adminWithdraw.denominator.toString()
    );
    expect(newFees.trade.denominator.toString()).to.equal(
      RECOMMENDED_FEES.trade.denominator.toString()
    );
    expect(newFees.withdraw.denominator.toString()).to.equal(
      RECOMMENDED_FEES.withdraw.denominator.toString()
    );
  });

  it("Send fees to beneficiary", async () => {
    const stableSwap = await StableSwap.load(
      provider.connection,
      swapAccount,
      SWAP_PROGRAM_ID
    );

    const expectedAmount = new u64(1_000_000_000);
    const mintToTx = TransactionEnvelope.combineAll(
      ...[stableSwap.state.tokenA, stableSwap.state.tokenB].map((token) =>
        createMintToInstruction({
          provider,
          mint: token.mint,
          mintAuthorityKP: minter,
          to: token.adminFeeAccount,
          amount: expectedAmount,
        })
      )
    );
    await expectTX(mintToTx, "mint to swap fee accounts").to.be.fulfilled;

    const poolWrapper = await pmWrapper
      .withSigner(admin)
      .loadPoolWrapperFromMints(mintA, mintB);
    await assertTXSuccess(
      await poolWrapper.sendFeesToBeneficiary(stableSwap.state),
      "send fees to beneficiary"
    );

    const beneficiary = pmWrapper.data?.beneficiary;
    invariant(beneficiary, "pool manager beneficiary must exist");
    const { accounts } = await getATAAddresses({
      mints: {
        mintA,
        mintB,
      },
      owner: beneficiary,
    });

    const accountA = await getTokenAccount(provider, accounts.mintA.address);
    expect(accountA.amount).to.bignumber.eq(expectedAmount);
    const accountB = await getTokenAccount(provider, accounts.mintB.address);
    expect(accountB.amount).to.bignumber.eq(expectedAmount);
  });
});
