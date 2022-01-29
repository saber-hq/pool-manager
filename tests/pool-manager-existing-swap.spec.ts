/// <reference types="mocha" />

import { assertTXSuccess, expectTX } from "@saberhq/chai-solana";
import {
  DEFAULT_TOKEN_DECIMALS,
  deployNewSwap,
  StableSwap,
  SWAP_PROGRAM_ID,
} from "@saberhq/stableswap-sdk";
import {
  createMint,
  getATAAddresses,
  SPLToken,
  TOKEN_PROGRAM_ID,
  u64,
} from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

import { comparePubkeys } from "../src";
import type { PoolManagerWrapper } from "../src/wrappers/poolManager";
import { makePoolManagerSDK } from "./testutils";

describe("Saber Pool Manager with existing swap", () => {
  const sdk = makePoolManagerSDK();
  const { provider } = sdk;
  const admin = provider.wallet;
  const minter = Keypair.generate();

  let stableSwap: StableSwap;
  let poolManager: PoolManagerWrapper;
  let mintA: PublicKey;
  let mintB: PublicKey;

  before(async () => {
    await expectTX(provider.requestAirdrop(100 * LAMPORTS_PER_SOL)).to.be
      .fulfilled;
    await expectTX(
      provider.withSigner(minter).requestAirdrop(100 * LAMPORTS_PER_SOL)
    ).to.be.fulfilled;

    const { wrapper, tx } = await sdk.newManager({
      admin: admin.publicKey,
      operator: minter.publicKey,
    });
    await expectTX(tx, "create pool manager").to.be.fulfilled;
    poolManager = wrapper;
  });

  beforeEach(async () => {
    const mint1 = await createMint(
      provider,
      minter.publicKey,
      DEFAULT_TOKEN_DECIMALS
    );
    const mint2 = await createMint(
      provider,
      minter.publicKey,
      DEFAULT_TOKEN_DECIMALS
    );

    if (comparePubkeys(mint1, mint2) === -1) {
      mintA = mint1;
      mintB = mint2;
    } else {
      mintA = mint2;
      mintB = mint1;
    }

    const initialAdmin = minter.publicKey;

    const { swap } = await deployNewSwap({
      provider,
      swapProgramID: SWAP_PROGRAM_ID,

      tokenAMint: mintA,
      tokenBMint: mintB,
      adminAccount: minter.publicKey,
      ampFactor: new u64(1_000),

      seedPoolAccounts: ({ tokenAAccount, tokenBAccount }) => ({
        instructions: [
          SPLToken.createMintToInstruction(
            TOKEN_PROGRAM_ID,
            mintA,
            tokenAAccount,
            initialAdmin,
            [],
            1_000_000
          ),
          SPLToken.createMintToInstruction(
            TOKEN_PROGRAM_ID,
            mintB,
            tokenBAccount,
            minter.publicKey,
            [],
            1_000_000
          ),
        ],
        signers: [minter],
      }),
    });
    stableSwap = swap;
  });

  it("Import existing pool by admin", async () => {
    const { swapAccount } = stableSwap.config;
    const { poolBump, poolKey, tx } = await poolManager.importPoolAsOperator(
      swapAccount,
      minter.publicKey
    );
    tx.addSigners(minter);
    await assertTXSuccess(tx, "import pool admin");

    const data = await poolManager.loadPool(poolKey);
    expect(data.bump).to.equal(poolBump);
    expect(data.index.toString()).to.equal("0");
    expect(data.manager).eqAddress(poolManager.key);
    expect(data.mintA).eqAddress(mintA);
    expect(data.mintB).eqAddress(mintB);
    expect(data.swap).eqAddress(stableSwap.config.swapAccount);
    expect(data.lpMint).eqAddress(stableSwap.state.poolTokenMint);
    expect(data.tokenDecimals).equal(DEFAULT_TOKEN_DECIMALS);
    expect(data.permissionlessImport).to.be.false;

    const { accounts } = await getATAAddresses({
      mints: {
        mintA,
        mintB,
      },
      owner: poolKey,
    });
    const fetchedStableSwap = await StableSwap.load(
      provider.connection,
      swapAccount
    );
    expect(fetchedStableSwap.state.adminAccount).eqAddress(poolKey);
    expect(fetchedStableSwap.state.tokenA.adminFeeAccount).eqAddress(
      accounts.mintA.address
    );
    expect(fetchedStableSwap.state.tokenB.adminFeeAccount).eqAddress(
      accounts.mintB.address
    );
  });
});
