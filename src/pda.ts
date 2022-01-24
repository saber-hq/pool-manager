import { utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import { POOLS_ADDRESSES } from "./constants";
import { comparePubkeys } from "./utils/comparePubkeys";

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
