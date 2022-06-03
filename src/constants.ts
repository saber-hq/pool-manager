import { buildCoderMap } from "@saberhq/anchor-contrib";
import { PublicKey } from "@solana/web3.js";

import { PoolsJSON } from "./idls/pools.js";
import type { PoolsProgram, PoolsTypes } from "./types.js";

export interface PoolsPrograms {
  Pools: PoolsProgram;
}

// See `Anchor.toml` for all addresses.
export const POOLS_ADDRESSES = {
  Pools: new PublicKey("SMANK4F5osjfVpKFH5LPzE6HPpbzSPu5iHPBhuor5xU"),
};

export const POOLS_IDLS = {
  Pools: PoolsJSON,
};

// Matches Curve's MIN_RAMP_DURATION.
export const MIN_RAMP_DURATION = 86_400;

export const POOLS_CODERS = buildCoderMap<{
  Pools: PoolsTypes;
}>(POOLS_IDLS, POOLS_ADDRESSES);

/**
 * Key for the Saber pool manager.
 */
export const POOL_MANAGER_KEY = new PublicKey(
  "XD5s9eMuSibXzczBysd8VmG6nVe7DjqMQK1iZMQjANd"
);
