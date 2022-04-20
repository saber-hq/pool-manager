import type { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { Fees, StableSwapState } from "@saberhq/stableswap-sdk";
import { SWAP_PROGRAM_ID } from "@saberhq/stableswap-sdk";
import { getOrCreateATAs, TOKEN_PROGRAM_ID, u64 } from "@saberhq/token-utils";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";

import type { PoolManagerSDK } from "../poolManagerSdk";
import type { PoolData, PoolsProgram, SwapFees } from "../types";

/**
 * Wrapper class for Pool. Methods operate on the object's Pool and Swap.
 */
export class PoolWrapper {
  readonly program: PoolsProgram;

  /**
   * Typically, constructor should not be directly called, and PoolManagerWrapper::load* functions should
   * be used instead.
   */
  constructor(
    readonly sdk: PoolManagerSDK,
    readonly key: PublicKey,
    readonly data: PoolData,
    readonly admin: PublicKey
  ) {
    this.program = sdk.programs.Pools;
  }

  rampA(targetAmp: u64, stopRampTs: number): TransactionEnvelope {
    const instruction = this.program.instruction.rampA(
      targetAmp,
      new u64(stopRampTs),
      {
        accounts: {
          ...this._getCommonAccounts(),
        },
      }
    );

    return this.sdk.newTx([instruction]);
  }

  stopRampA(): TransactionEnvelope {
    const instruction = this.program.instruction.stopRampA({
      accounts: {
        ...this._getCommonAccounts(),
      },
    });

    return this.sdk.newTx([instruction]);
  }

  pauseSwap(): TransactionEnvelope {
    const instruction = this.program.instruction.pauseSwap({
      accounts: this._getCommonAccounts(),
    });

    return this.sdk.newTx([instruction]);
  }

  unpauseSwap(): TransactionEnvelope {
    const instruction = this.program.instruction.unpauseSwap({
      accounts: this._getCommonAccounts(),
    });

    return this.sdk.newTx([instruction]);
  }

  commitNewAdmin(newAdmin: PublicKey): TransactionEnvelope {
    const instruction = this.program.instruction.commitNewAdmin({
      accounts: {
        ...this._getCommonAccounts(),
        newAdmin,
      },
    });

    return this.sdk.newTx([instruction]);
  }

  applyNewAdmin(): TransactionEnvelope {
    const instruction = this.program.instruction.applyNewAdmin({
      accounts: {
        ...this._getCommonAccounts(),
      },
    });

    return this.sdk.newTx([instruction]);
  }

  setNewFees(newFees: Fees): TransactionEnvelope {
    return this.sdk.newTx([
      this.program.instruction.setNewFees(encodeFees(newFees), {
        accounts: this._getCommonAccounts(),
      }),
    ]);
  }

  setBeneficiary(newBeneficiary: PublicKey): TransactionEnvelope {
    return this.sdk.newTx([
      this.program.instruction.setBeneficiary({
        accounts: {
          poolManager: this.data.manager,
          admin: this.admin,
          beneficiary: newBeneficiary,
        },
      }),
    ]);
  }

  setOperator(newOperator: PublicKey): TransactionEnvelope {
    return this.sdk.newTx([
      this.program.instruction.setOperator({
        accounts: {
          poolManager: this.data.manager,
          admin: this.admin,
          operator: newOperator,
        },
      }),
    ]);
  }

  async sendFeesToBeneficiary(
    swapState: StableSwapState
  ): Promise<TransactionEnvelope> {
    const poolManagerData =
      await this.sdk.programs.Pools.account.poolManager.fetch(
        this.data.manager
      );

    const allInstructions: TransactionInstruction[] = [];
    const { accounts, instructions } = await getOrCreateATAs({
      provider: this.sdk.provider,
      mints: {
        mintA: this.data.mintA,
        mintB: this.data.mintB,
      },
      owner: poolManagerData.beneficiary,
    });
    if (instructions) {
      allInstructions.push(...instructions);
    }
    allInstructions.push(
      this.program.instruction.sendFeesToBeneficiary({
        accounts: {
          poolManager: this.data.manager,
          pool: this.key,
          feeAccount: swapState.tokenA.adminFeeAccount,
          beneficiaryAccount: accounts.mintA,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      })
    );
    allInstructions.push(
      this.program.instruction.sendFeesToBeneficiary({
        accounts: {
          poolManager: this.data.manager,
          pool: this.key,
          feeAccount: swapState.tokenB.adminFeeAccount,
          beneficiaryAccount: accounts.mintB,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      })
    );

    return this.sdk.newTx(allInstructions);
  }

  private _getCommonAccounts() {
    return {
      poolManager: this.data.manager,
      pool: this.key,
      swap: this.data.swap,
      swapProgram: SWAP_PROGRAM_ID,
      admin: this.admin,
    };
  }
}

const encodeFees = (fees: Fees): SwapFees => ({
  adminTradeFeeNumerator: new u64(fees.adminTrade.numerator.toString()),
  adminTradeFeeDenominator: new u64(fees.adminTrade.denominator.toString()),
  adminWithdrawFeeNumerator: new u64(fees.adminWithdraw.numerator.toString()),
  adminWithdrawFeeDenominator: new u64(
    fees.adminWithdraw.denominator.toString()
  ),
  tradeFeeNumerator: new u64(fees.trade.numerator.toString()),
  tradeFeeDenominator: new u64(fees.trade.denominator.toString()),
  withdrawFeeNumerator: new u64(fees.withdraw.numerator.toString()),
  withdrawFeeDenominator: new u64(fees.withdraw.denominator.toString()),
});
