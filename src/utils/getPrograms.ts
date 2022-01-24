import { newProgramMap } from "@saberhq/anchor-contrib";
import type { Provider } from "@saberhq/solana-contrib";

import type { PoolsPrograms } from "../constants";
import { POOLS_ADDRESSES, POOLS_IDLS } from "../constants";

export default function getPrograms(
  provider: Provider,
  addresses = POOLS_ADDRESSES
): PoolsPrograms {
  return newProgramMap<PoolsPrograms>(provider, POOLS_IDLS, addresses);
}
