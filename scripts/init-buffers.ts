import { GokiSDK } from "@gokiprotocol/client";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, PACKET_DATA_SIZE } from "@solana/web3.js";
import { BN } from "bn.js";

import { getRpcUrl, loadKeyConfigs } from "./helpers/loadConfigs";

const NUM_BUFFERS = 3;
const BUFFER_SIZE = 30 * PACKET_DATA_SIZE;
export const NUM_BUNDLES = 40;

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
    console.log(
      JSON.stringify(
        { number: i, bufferAccount: bufferAccount.toString() },
        null,
        2
      )
    );
  }
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
