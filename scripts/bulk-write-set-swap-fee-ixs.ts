import { GokiSDK } from "@gokiprotocol/client";
import type { Network } from "@saberhq/solana-contrib";
import {
  formatNetwork,
  SignerWallet,
  SolanaProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { Fees } from "@saberhq/stableswap-sdk";
import { RECOMMENDED_FEES } from "@saberhq/stableswap-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import * as axios from "axios";
import invariant from "tiny-invariant";

import { PoolManagerSDK } from "../src";
import type { PoolWrapper } from "../src/wrappers/pool";
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
    `https://registry.saber.so/data/pools-info.${
      network === "localnet" ? "devnet" : network
    }.json`
  );
  const registryData = resp.data;
  const poolWrappers = await Promise.all(
    registryData.pools.slice(0, 3).map(async (p) => {
      try {
        return await pmW.loadPoolWrapperFromMints(
          new PublicKey(p.swap.state.tokenA.mint),
          new PublicKey(p.swap.state.tokenB.mint)
        );
      } catch (e) {
        const error = e as Error;
        console.warn(
          `failed to load pool wrapper for ${p.name}; ${error.message}`
        );
        return null;
      }
    })
  );

  const ixs = poolWrappers
    .filter((pw): pw is PoolWrapper => !!pw)
    .map((pw) => pw.setNewFees(RECOMMENDED_FEES));

  const bundleIndices = new Array<number>(keysCfg.buffers.length).fill(0);
  const appendBufferTxs: TransactionEnvelope[] = [];
  for (let i = 0; i < 100; i++) {
    const ix = ixs[i % ixs.length]?.getInstruction(0);
    invariant(ix, "instruction");

    const bufferIdx = i % keysCfg.buffers.length;
    const buffer = keysCfg.buffers[bufferIdx];
    invariant(buffer, "buffer does not exist");

    const bundleIdx = bundleIndices[bufferIdx];
    invariant(bundleIdx !== undefined, "bundleIdx");
    const tx = gokiSDK.instructionBuffer.appendInstruction(
      buffer,
      bundleIdx,
      ix,
      keysCfg.bufferAuthorityKP.publicKey
    );
    bundleIndices[bufferIdx] = bundleIdx + 1;

    tx.addSigners(keysCfg.bufferAuthorityKP);
    appendBufferTxs.push(tx);
  }

  const txs = TransactionEnvelope.pack(...appendBufferTxs);
  await Promise.all(
    txs.map(async (tx, i) => {
      console.log("tx number:", i);
      const pendingTx = await tx.send();
      const confirmedTx = await pendingTx.wait({ commitment: "confirmed" });
      confirmedTx.printLogs();
    })
  );

  await Promise.all(
    keysCfg.buffers.map(async (buffer) => {
      const bufferData = await gokiSDK.instructionBuffer.loadData(buffer);
      console.log(
        `buffer ${buffer.toString()}, bundles: ${bufferData.bundles.length}`
      );
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
