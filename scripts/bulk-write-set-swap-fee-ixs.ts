import { GokiSDK } from "@gokiprotocol/client";
import type { Network } from "@saberhq/solana-contrib";
import { formatNetwork } from "@saberhq/solana-contrib";
import {
  SignerWallet,
  SolanaProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { Fees } from "@saberhq/stableswap-sdk";
import { RECOMMENDED_FEES } from "@saberhq/stableswap-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import * as axios from "axios";

import { PoolManagerSDK } from "../src";
import { getRpcUrl, loadKeyConfigs } from "./helpers/loadConfigs";

interface TokenInfo {
  adminFeeAccount: string;
  reserve: string;
  mint: string;
}

interface StableSwapState {
  /**
   * Whether or not the swap is initialized.
   */
  isInitialized: boolean;

  /**
   * Whether or not the swap is paused.
   */
  isPaused: boolean;

  /**
   * Nonce used to generate the swap authority.
   */
  nonce: number;

  /**
   * Mint account for pool token
   */
  poolTokenMint: string;

  /**
   * Admin account
   */
  adminAccount: string;

  tokenA: TokenInfo;
  tokenB: TokenInfo;

  /**
   * Initial amplification coefficient (A)
   */
  initialAmpFactor: string;

  /**
   * Target amplification coefficient (A)
   */
  targetAmpFactor: string;

  /**
   * Ramp A start timestamp
   */
  startRampTimestamp: number;

  /**
   * Ramp A start timestamp
   */
  stopRampTimestamp: number;

  /**
   * When the future admin can no longer become the admin, if applicable.
   */
  futureAdminDeadline: number;

  /**
   * The next admin.
   */
  futureAdminAccount: string;

  /**
   * Fee schedule
   */
  fees: Fees;
}

interface PoolInfo {
  id: string;
  name: string;
  tokens: any;
  tokenIcons: any;
  underlyingIcons: any;
  currency: string;
  lpToken: string;

  plotKey: string;
  swap: {
    config: {
      /**
       * The public key identifying this instance of the Stable Swap.
       */
      swapAccount: string;
      /**
       * Authority
       */
      authority: string;
      /**
       * Program Identifier for the Swap program
       */
      swapProgramID: string;
      /**
       * Program Identifier for the Token program
       */
      tokenProgramID: string;
    };
    state: StableSwapState;
  };
  newPoolID?: string;

  /**
   * Optional info on why the pool is deprecated.
   */
  deprecationInfo?: {
    /**
     * The pool that users should migrate their assets to.
     */
    newPoolID?: string;
    /**
     * Message showing why the pool is deprecated.
     */
    message?: string;
    /**
     * Link to more information.
     */
    link?: string;
  };
  tags?: readonly any[];
  summary: any;
}

interface RegistryData {
  addresses: any;
  pools: PoolInfo[];
}

const main = async () => {
  const network = formatNetwork((process.env.NETWORK as Network) ?? "devnet");
  const connection = new Connection(getRpcUrl());
  const keysCfg = loadKeyConfigs();
  const provider = SolanaProvider.init({
    connection,
    wallet: new SignerWallet(keysCfg.payerKP),
  });
  const gokiSDK = GokiSDK.load({ provider });
  const pmSDK = PoolManagerSDK.load({ provider });
  const pmW = await pmSDK.loadManager(keysCfg.poolManager);

  const resp = await axios.default.get<RegistryData>(
    `https://registry.saber.so/data/pools-info.${network}.json`
  );
  const registryData = resp.data;
  const poolWrappers = await Promise.all(
    registryData.pools.map(
      async (p) =>
        await pmW.loadPoolWrapperFromMints(
          new PublicKey(p.swap.state.tokenA.mint),
          new PublicKey(p.swap.state.tokenB.mint)
        )
    )
  );

  const ixs = poolWrappers.map((pw) => pw.setNewFees(RECOMMENDED_FEES));
  const writeIxs = ixs.map((ix, i) => {
    const tx = gokiSDK.instructionBuffer.appendInstruction(
      keysCfg.buffer,
      i,
      ix.getInstruction(0),
      keysCfg.bufferAuthorityKP.publicKey
    );
    tx.addSigners(keysCfg.bufferAuthorityKP);
    return tx;
  });
  const txs = TransactionEnvelope.combineAll(...writeIxs).partition();

  await Promise.all(
    txs.map(async (tx) => {
      const pendingTx = await tx.send();
      const confirmedTx = await pendingTx.wait();
      confirmedTx.printLogs();
    })
  );
};

main()
  .then()
  .catch((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
