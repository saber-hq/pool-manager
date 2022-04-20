import type { AnchorTypes } from "@saberhq/anchor-contrib";
import type { TransactionEnvelope } from "@saberhq/solana-contrib";
import type { u64 } from "@saberhq/token-utils";
import type { PublicKey, Signer } from "@solana/web3.js";

import type { PoolsIDL } from "./idls/pools";
import type { PoolManagerSDK } from "./poolManagerSdk";
import type { PoolManagerWrapper } from "./wrappers/poolManager";

export type PoolsTypes = AnchorTypes<
  PoolsIDL,
  {
    pool: PoolData;
    poolManager: PoolManagerData;
  }
>;

export type SwapFees = PoolsTypes["Defined"]["SwapFees"];

type pmAccounts = PoolsTypes["Accounts"];
export type PoolData = pmAccounts["Pool"];
export type PoolManagerData = pmAccounts["PoolManager"];

export type PoolsError = PoolsTypes["Error"];
export type PoolsEvents = PoolsTypes["Events"];
export type PoolsProgram = PoolsTypes["Program"];

export type PoolManagerWrapperCtorArgs = {
  sdk: PoolManagerSDK;
  admin: PublicKey;
  operator?: PublicKey;
  beneficiary?: PublicKey;
  base?: Signer;
};

export type StableSwapCtorArgs = {
  ampFactor: u64;
  swapAccountSigner?: Signer;
  mintA: PublicKey;
  reserveA: PublicKey;
  mintB: PublicKey;
  reserveB: PublicKey;
  mintLP: PublicKey;
  outputLp?: PublicKey;
};

export type PendingPoolManagerWrapper = {
  wrapper: PoolManagerWrapper;
  tx: TransactionEnvelope;
};

export type PendingStableSwap = {
  swapAccount: PublicKey;
  mintLP: PublicKey;
  poolBump: number;
  poolKey: PublicKey;
  tx: TransactionEnvelope;
};

export type PendingPool = {
  poolBump: number;
  poolKey: PublicKey;
  tx: TransactionEnvelope;
};
