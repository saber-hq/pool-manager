import { GokiSDK } from "@gokiprotocol/client";
import type { Network, TransactionEnvelope } from "@saberhq/solana-contrib";
import {
  formatNetwork,
  SignerWallet,
  SolanaProvider,
} from "@saberhq/solana-contrib";
import type { Fees } from "@saberhq/stableswap-sdk";
import { Percent } from "@saberhq/token-utils";
import { Connection, PublicKey } from "@solana/web3.js";
import * as axios from "axios";
import { BN } from "bn.js";
import zip from "lodash.zip";
import invariant from "tiny-invariant";

import type { PoolData } from "../src";
import { findSaberPool, PoolManagerSDK } from "../src";
import { PoolWrapper } from "../src/wrappers/pool";
import { loadBuffers } from "./helpers/loadBuffers";
import { getRpcUrl, loadKeyConfigs } from "./helpers/loadConfigs";

const NEW_ADMIN_FEE = new Percent(new BN(50), new BN(100));

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
}

interface RegistryData {
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

  const poolKeys = await Promise.all(
    registryData.pools.map(async (poolInfo) => {
      const [poolKey] = await findSaberPool(
        keysCfg.poolManager,
        new PublicKey(poolInfo.swap.state.tokenA.mint),
        new PublicKey(poolInfo.swap.state.tokenB.mint)
      );
      return poolKey;
    })
  );

  const poolsData = await pmSDK.provider.connection.getMultipleAccountsInfo(
    poolKeys
  );
  const poolsDataParsed = poolsData.map((buf) => {
    const data = buf?.data;
    invariant(data, "data not found");
    return pmSDK.programs.Pools.coder.accounts.decode<PoolData>("Pool", data);
  });

  const poolWrappers = zip(poolKeys, poolsDataParsed).map(
    ([key, parsedData]) => {
      invariant(key, "pool key not found");
      invariant(pmW.data, "poolManager data");
      invariant(parsedData, "pool data not found");

      return new PoolWrapper(pmSDK, key, parsedData, pmW.data.admin);
    }
  );

  const ixs = await Promise.all(
    poolWrappers.map((pw) => {
      const swap = pw.data.swap;
      const poolInfo = registryData.pools.find(
        (poolInfo) => poolInfo.swap.config.swapAccount === swap.toString()
      );
      invariant(poolInfo, "poolInfo not found");
      const {
        adminTrade: __unused1,
        adminWithdraw: __unused2,
        ...prevFees
      } = poolInfo.swap.state.fees;

      const newFees: Fees = {
        adminTrade: NEW_ADMIN_FEE,
        adminWithdraw: NEW_ADMIN_FEE,
        ...prevFees,
      };
      return pw.setNewFees(newFees);
    })
  );

  const buffers = loadBuffers();
  const bundleIndices = new Array<number>(buffers.length).fill(0);
  const appendBufferTxs: TransactionEnvelope[] = [];
  for (let i = 0; i < 100; i++) {
    const ix = ixs[i % ixs.length]?.getInstruction(0);
    invariant(ix, "instruction");

    const bufferIdx = i % buffers.length;
    const buffer = buffers[bufferIdx];
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

  const txs: TransactionEnvelope[] = [];
  while (appendBufferTxs) {
    const tx1 = appendBufferTxs.shift();
    if (!tx1) {
      break;
    }

    const tx2 = appendBufferTxs.pop();
    txs.push(tx2 ? tx1.combine(tx2) : tx1);
  }

  if (network === "mainnet" && process.env.DRY_RUN === "false") {
    await Promise.all(
      txs.map(async (tx) => {
        const pendingTx = await tx.send();
        const confirmedTx = await pendingTx.wait({ commitment: "finalized" });
        confirmedTx.printLogs();
        console.log("\n");
      })
    );
  }

  console.log(
    `wrote to buffers ... ${buffers.map((b) => b.toString()).join(", ")}`
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
