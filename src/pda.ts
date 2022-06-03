import { utils } from "@project-serum/anchor";
import { getProgramAddress } from "@saberhq/solana-contrib";
import { PublicKey } from "@solana/web3.js";

import { POOLS_ADDRESSES } from "./constants.js";
import { comparePubkeys } from "./utils/comparePubkeys.js";

export const findSaberPoolManager = async (
  base: PublicKey
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode("SaberPoolManager"), base.toBytes()],
    POOLS_ADDRESSES.Pools
  );
};

export const findSaberPool = async (
  poolManager: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<[PublicKey, number]> => {
  const [sortedMintA, sortedMintB] =
    comparePubkeys(mintA, mintB) !== -1 ? [mintB, mintA] : [mintA, mintB];
  return await findSaberPoolSorted(poolManager, sortedMintA, sortedMintB);
};

export const findSaberPoolSorted = async (
  poolManager: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [
      utils.bytes.utf8.encode("SaberPool"),
      poolManager.toBytes(),
      mintA.toBytes(),
      mintB.toBytes(),
    ],
    POOLS_ADDRESSES.Pools
  );
};

export const getSaberPoolManager = (base: PublicKey): PublicKey => {
  return getProgramAddress(
    [utils.bytes.utf8.encode("SaberPoolManager"), base.toBytes()],
    POOLS_ADDRESSES.Pools
  );
};

export const getSaberPool = (
  poolManager: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): PublicKey => {
  const [sortedMintA, sortedMintB] =
    comparePubkeys(mintA, mintB) !== -1 ? [mintB, mintA] : [mintA, mintB];
  return getSaberPoolSorted(poolManager, sortedMintA, sortedMintB);
};

export const getSaberPoolSorted = (
  poolManager: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey
): PublicKey => {
  return getProgramAddress(
    [
      utils.bytes.utf8.encode("SaberPool"),
      poolManager.toBytes(),
      mintA.toBytes(),
      mintB.toBytes(),
    ],
    POOLS_ADDRESSES.Pools
  );
};
