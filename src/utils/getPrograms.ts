import { newProgramMap } from "@saberhq/anchor-contrib";
import type { Provider } from "@saberhq/solana-contrib";

import type { PoolsPrograms } from "../constants.js";
import { POOLS_ADDRESSES, POOLS_IDLS } from "../constants.js";

export default function getPrograms(
  provider: Provider,
  addresses = POOLS_ADDRESSES
): PoolsPrograms {
  return newProgramMap<PoolsPrograms>(provider, POOLS_IDLS, addresses);
}
