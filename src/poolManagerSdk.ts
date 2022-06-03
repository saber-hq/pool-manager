import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type {
  PublicKey,
  Signer,
  TransactionInstruction,
} from "@solana/web3.js";
import mapValues from "lodash.mapvalues";

import type { PoolsPrograms } from "./constants.js";
import { POOL_MANAGER_KEY, POOLS_ADDRESSES } from "./constants.js";
import type {
  PendingPoolManagerWrapper,
  PoolManagerWrapperCtorArgs,
} from "./types.js";
import getPrograms from "./utils/getPrograms.js";
import { PoolManagerWrapper } from "./wrappers/poolManager.js";

/**
 * Pool Manager SDK
 */
export class PoolManagerSDK {
  constructor(
    readonly provider: AugmentedProvider,
    readonly programs: PoolsPrograms
  ) {}

  /**
   * Creates a new instance of the SDK with the given keypair.
   */
  withSigner(signer: Signer): PoolManagerSDK {
    return PoolManagerSDK.load({
      provider: this.provider.withSigner(signer),
      addresses: mapValues(this.programs, (v) => v.programId),
    });
  }

  /**
   * Loads the SDK.
   * @returns
   */
  static load({
    provider,
    addresses = POOLS_ADDRESSES,
  }: {
    // Provider
    provider: Provider;
    // Addresses of each program.
    addresses?: { [K in keyof PoolsPrograms]?: PublicKey };
  }): PoolManagerSDK {
    const allAddresses = { ...POOLS_ADDRESSES, ...addresses };
    const programs = getPrograms(provider, allAddresses);
    return new PoolManagerSDK(new SolanaAugmentedProvider(provider), programs);
  }

  /**
   * loadManager
   */
  async loadManager(
    key: PublicKey = POOL_MANAGER_KEY
  ): Promise<PoolManagerWrapper> {
    return await PoolManagerWrapper.load(this, key);
  }

  /**
   * newManager
   */
  async newManager(
    args: Omit<PoolManagerWrapperCtorArgs, "sdk">
  ): Promise<PendingPoolManagerWrapper> {
    return await PoolManagerWrapper.newWrapper({ sdk: this, ...args });
  }

  newTx(
    instructions: TransactionInstruction[],
    signers?: Signer[]
  ): TransactionEnvelope {
    return new TransactionEnvelope(this.provider, instructions, signers);
  }
}
