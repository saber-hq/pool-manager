import { GokiSDK } from "@gokiprotocol/client";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection } from "@solana/web3.js";
import { BN } from "bn.js";
import * as fs from "fs/promises";

import { getRpcUrl, loadKeyConfigs } from "./helpers/loadConfigs";

const NUM_BUFFERS = process.env.NUM_BUFFERS ?? 4;
const BUFFER_SIZE = parseInt(process.env.BUFFER_SIZE ?? (100 * 412).toString());
export const NUM_BUNDLES = 25;

const main = async () => {
  const connection = new Connection(getRpcUrl());

  const keysCfg = loadKeyConfigs();
  const provider = SolanaProvider.init({
    connection,
    wallet: new SignerWallet(keysCfg.payerKP),
  });

  const gokiSDK = GokiSDK.load({
    provider,
  });

  const buffers = [];
  for (let i = 0; i < NUM_BUFFERS; i++) {
    const { tx, bufferAccount: bufferAccount } =
      await gokiSDK.instructionBuffer.initBuffer({
        bufferSize: BUFFER_SIZE,
        smartWallet: keysCfg.smartWallet,
        eta: new BN(-1),
        numBundles: NUM_BUNDLES,
        authority: keysCfg.bufferAuthorityKP.publicKey,
        executor: keysCfg.executorAuthorityKP.publicKey,
      });
    tx.addSigners(keysCfg.bufferAuthorityKP, keysCfg.executorAuthorityKP);
    const pendingTx = await tx.send();
    const confirmedTx = await pendingTx.wait();
    confirmedTx.printLogs();

    buffers.push(bufferAccount.toString());
  }

  const buffersJSON = JSON.stringify({ buffers }, null, 2);
  console.log(buffersJSON);

  const f = `${__dirname}/../.configs/buffers.json`;
  await fs.writeFile(f, buffersJSON);
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
