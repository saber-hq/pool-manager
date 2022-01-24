import { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { Fees } from "@saberhq/stableswap-sdk";
import {
  createAdminApplyNewAdminInstruction,
  createAdminCommitNewAdminInstruction,
  createAdminSetFeeAccountInstruction,
  encodeFees,
  findSwapAuthorityKey,
  initializeSwapInstructionRaw,
  StableSwap,
  StableSwapLayout,
  SWAP_PROGRAM_ID,
} from "@saberhq/stableswap-sdk";
import {
  getOrCreateATA,
  getOrCreateATAs,
  Percent,
  TOKEN_PROGRAM_ID,
} from "@saberhq/token-utils";
import type {
  PublicKey,
  Signer,
  TransactionInstruction,
} from "@solana/web3.js";
import { Keypair, SystemProgram } from "@solana/web3.js";
import invariant from "tiny-invariant";

import { findSaberPool, findSaberPoolManager } from "../pda";
import type { PoolManagerSDK } from "../poolManagerSdk";
import type {
  PendingPool,
  PendingPoolManagerWrapper,
  PendingStableSwap,
  PoolData,
  PoolManagerData,
  PoolManagerWrapperCtorArgs,
  PoolsProgram,
  StableSwapCtorArgs,
} from "../types";
import { comparePubkeys } from "../utils/comparePubkeys";
import { PoolWrapper } from "./pool";

type TokenAccounts = {
  fees: PublicKey;
  reserve: PublicKey;
  mint: PublicKey;
};

type PendingTokenAccounts<K extends string> = {
  /**
   * Fee and reserve accounts
   */
  accounts: {
    [mint in K]: TokenAccounts;
  };
  /**
   * Instructions to create accounts that don't exist.
   */
  instructions: readonly TransactionInstruction[];
};

export class PoolManagerWrapper {
  readonly program: PoolsProgram;
  data: PoolManagerData | undefined;

  constructor(
    readonly sdk: PoolManagerSDK,
    readonly key: PublicKey,
    data?: PoolManagerData
  ) {
    this.program = sdk.programs.Pools;
    this.data = data;
  }

  /**
   *  Loads this {@link PoolManagerWrapper} with the given signer.
   * @param signer
   * @returns
   */
  withSigner(signer: Signer): PoolManagerWrapper {
    return new PoolManagerWrapper(
      this.sdk.withSigner(signer),
      this.key,
      this.data
    );
  }

  /**
   * Creates a new PoolManager.
   */
  static async newWrapper({
    sdk,
    admin,
    operator = admin,
    beneficiary = admin,
    base = Keypair.generate(),
  }: PoolManagerWrapperCtorArgs): Promise<PendingPoolManagerWrapper> {
    const [poolManager, bump] = await findSaberPoolManager(base.publicKey);
    const initIx = sdk.programs.Pools.instruction.newPoolManager(bump, {
      accounts: {
        poolManager,
        base: base.publicKey,
        payer: sdk.provider.wallet.publicKey,
        admin,
        operator,
        beneficiary,
        systemProgram: SystemProgram.programId,
      },
    });
    return {
      wrapper: new PoolManagerWrapper(sdk, poolManager),
      tx: new TransactionEnvelope(sdk.provider, [initIx], [base]),
    };
  }

  /**
   * load
   */
  static async load(
    sdk: PoolManagerSDK,
    key: PublicKey
  ): Promise<PoolManagerWrapper> {
    const data = await sdk.programs.Pools.account.poolManager.fetch(key);
    return new PoolManagerWrapper(sdk, key, data);
  }

  /**
   * loadPool
   */
  async loadPool(key: PublicKey): Promise<PoolData> {
    return await this.sdk.programs.Pools.account.pool.fetch(key);
  }

  /**
   * loadPoolWrapper
   */
  async loadPoolWrapper(poolKey: PublicKey): Promise<PoolWrapper> {
    const poolData = await this.loadPool(poolKey);
    if (!this.data) {
      await this.reloadData();
    }
    invariant(this.data, "Data must not be null");
    return new PoolWrapper(this.sdk, poolKey, poolData, this.data.admin);
  }

  /**
   * loadPoolWrapperFromMints
   */
  async loadPoolWrapperFromMints(
    mintA: PublicKey,
    mintB: PublicKey
  ): Promise<PoolWrapper> {
    const [poolKey] = await findSaberPool(this.key, mintA, mintB);
    return this.loadPoolWrapper(poolKey);
  }

  /**
   * reloadData
   */
  async reloadData(): Promise<PoolManagerData> {
    return (this.data = await this.program.account.poolManager.fetch(this.key));
  }

  /**
   * Initializes a new Stableswap
   */
  async newStableSwap(
    ctorArgs: StableSwapCtorArgs
  ): Promise<PendingStableSwap> {
    const { mintA, mintB, reserveA, reserveB, ...rest } = ctorArgs;
    const [sortedMintA, sortedReserveA, sortedMintB, sortedReserveB] =
      comparePubkeys(mintA, mintB) !== -1
        ? [mintB, reserveB, mintA, reserveA]
        : [mintA, reserveA, mintB, reserveB];

    return await this.newStableSwapSorted({
      mintA: sortedMintA,
      mintB: sortedMintB,
      reserveA: sortedReserveA,
      reserveB: sortedReserveB,
      ...rest,
    });
  }

  /**
   * Initializes a new StableSwap, assuming the inputs are sorted.
   */
  async newStableSwapSorted(
    ctorArgs: StableSwapCtorArgs
  ): Promise<PendingStableSwap> {
    const {
      ampFactor,
      mintA,
      mintB,
      mintLP,
      reserveA,
      reserveB,
      outputLp,
      swapAccountSigner = Keypair.generate(),
    } = ctorArgs;

    if (comparePubkeys(mintA, mintB) !== -1) {
      throw new Error("mints must be sorted");
    }

    const { provider } = this.sdk;
    const pmData = await this.reloadData();
    const initialFeesRaw = pmData.initialFees;
    const initialFees: Fees = {
      trade: new Percent(
        initialFeesRaw.tradeFeeNumerator,
        initialFeesRaw.tradeFeeDenominator
      ),
      withdraw: new Percent(
        initialFeesRaw.withdrawFeeNumerator,
        initialFeesRaw.withdrawFeeDenominator
      ),
      adminTrade: new Percent(
        initialFeesRaw.adminTradeFeeNumerator,
        initialFeesRaw.adminTradeFeeDenominator
      ),
      adminWithdraw: new Percent(
        initialFeesRaw.adminWithdrawFeeNumerator,
        initialFeesRaw.adminWithdrawFeeDenominator
      ),
    };

    const allInstructions: TransactionInstruction[] = [];
    let destinationPoolTokenAccount = outputLp;
    if (!destinationPoolTokenAccount) {
      const { address, instruction } = await getOrCreateATA({
        provider,
        mint: mintLP,
      });
      if (instruction) {
        allInstructions.push(instruction);
      }
      destinationPoolTokenAccount = address;
    }
    invariant(destinationPoolTokenAccount, "outputLP is not specified");

    const [pool, bump] = await findSaberPool(this.key, mintA, mintB);
    const { accounts, instructions } =
      await this._initFeeAndReserveTokenAccounts({
        mintA,
        reserveA,
        mintB,
        reserveB,
        pool,
      });
    allInstructions.push(...instructions);

    const balanceNeeded = await StableSwap.getMinBalanceRentForExemptStableSwap(
      provider.connection
    );

    allInstructions.push(
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: swapAccountSigner.publicKey,
        lamports: balanceNeeded,
        space: StableSwapLayout.span,
        programId: SWAP_PROGRAM_ID,
      })
    );

    const [swapAuthority, swapNonce] = await findSwapAuthorityKey(
      swapAccountSigner.publicKey
    );

    allInstructions.push(
      initializeSwapInstructionRaw({
        config: {
          swapAccount: swapAccountSigner.publicKey,
          authority: swapAuthority,
          swapProgramID: SWAP_PROGRAM_ID,
          tokenProgramID: TOKEN_PROGRAM_ID,
        },
        adminAccount: pool,
        tokenA: {
          adminFeeAccount: accounts.mintA.fees,
          reserve: accounts.mintA.reserve,
          mint: accounts.mintA.mint,
        },
        tokenB: {
          adminFeeAccount: accounts.mintB.fees,
          reserve: accounts.mintB.reserve,
          mint: accounts.mintB.mint,
        },
        poolTokenMint: mintLP,
        destinationPoolTokenAccount,
        nonce: swapNonce,
        ampFactor,
        fees: encodeFees(initialFees),
      })
    );

    const feeAccounts = await getOrCreateATAs({
      provider: this.sdk.provider,
      mints: {
        tokenA: accounts.mintA.mint,
        tokenB: accounts.mintB.mint,
      },
      owner: pool,
    });

    allInstructions.push(
      this.program.instruction.importPoolPermissionless(bump, {
        accounts: this._importPoolAccounts(
          swapAccountSigner.publicKey,
          pool,
          mintLP,
          feeAccounts.accounts.tokenA,
          feeAccounts.accounts.tokenB
        ),
      })
    );

    return {
      swapAccount: swapAccountSigner.publicKey,
      poolBump: bump,
      poolKey: pool,
      mintLP,
      tx: this.sdk.newTx(allInstructions, [swapAccountSigner]),
    };
  }

  /**
   * importPoolAdmin
   */
  async importPoolAsOperator(
    swapAccount: PublicKey,
    adminOrOperator: PublicKey = this.sdk.provider.wallet.publicKey
  ): Promise<PendingPool> {
    const { config, state } = await StableSwap.load(
      this.program.provider.connection,
      swapAccount
    );

    const [pool, bump] = await findSaberPool(
      this.key,
      state.tokenA.mint,
      state.tokenB.mint
    );

    const { accounts, instructions } = await getOrCreateATAs({
      provider: this.sdk.provider,
      mints: {
        mintA: state.tokenA.mint,
        mintB: state.tokenB.mint,
      },
      owner: pool,
    });

    const tx = this.sdk.newTx([
      ...instructions,
      createAdminSetFeeAccountInstruction({
        config,
        state,
        tokenAccount: accounts.mintA,
      }),
      createAdminSetFeeAccountInstruction({
        config,
        state,
        tokenAccount: accounts.mintB,
      }),
      createAdminCommitNewAdminInstruction({
        config,
        state,
        newAdminAccount: pool,
      }),
      createAdminApplyNewAdminInstruction({
        config,
        state,
      }),
      this.program.instruction.importPoolAsOperator(bump, {
        accounts: {
          adminOrOperator,
          importPool: this._importPoolAccounts(
            swapAccount,
            pool,
            state.poolTokenMint,
            accounts.mintA,
            accounts.mintB
          ),
        },
      }),
    ]);

    return {
      poolBump: bump,
      poolKey: pool,
      tx,
    };
  }

  private async _initFeeAndReserveTokenAccounts({
    mintA,
    reserveA,
    mintB,
    reserveB,
    pool,
  }: {
    mintA: PublicKey;
    reserveA: PublicKey;
    mintB: PublicKey;
    reserveB: PublicKey;
    pool: PublicKey;
  }): Promise<PendingTokenAccounts<"mintA" | "mintB">> {
    const { provider } = this.sdk;
    const mints = { mintA, mintB };

    const { accounts: feeAccounts, instructions: feeAccountIxs } =
      await getOrCreateATAs({
        provider,
        mints,
        owner: pool,
      });

    return {
      accounts: {
        mintA: {
          fees: feeAccounts.mintA,
          reserve: reserveA,
          mint: mintA,
        },
        mintB: {
          fees: feeAccounts.mintB,
          reserve: reserveB,
          mint: mintB,
        },
      },
      instructions: [...feeAccountIxs],
    };
  }

  private _importPoolAccounts(
    swap: PublicKey,
    pool: PublicKey,
    lpMint: PublicKey,
    tokenAFees: PublicKey,
    tokenBFees: PublicKey
  ): {
    poolManager: PublicKey;
    swap: PublicKey;
    pool: PublicKey;
    lpMint: PublicKey;
    tokenAFees: PublicKey;
    tokenBFees: PublicKey;
    payer: PublicKey;
    systemProgram: PublicKey;
  } {
    return {
      poolManager: this.key,
      swap,
      pool,
      lpMint,
      tokenAFees,
      tokenBFees,
      payer: this.program.provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    };
  }
}
