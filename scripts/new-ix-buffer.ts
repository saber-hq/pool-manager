import { GokiSDK } from "@gokiprotocol/client";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, PACKET_DATA_SIZE } from "@solana/web3.js";
import { BN } from "bn.js";

import { getRpcUrl, loadKeyConfigs } from "./helpers/loadConfigs";

const BUFFER_SIZE = 40 * PACKET_DATA_SIZE;

const main = async () => {
  const connection = new Connection(getRpcUrl());

  const keysCfg = loadKeyConfigs();
  const provider = SolanaProvider.init({
    connection,
    wallet: new SignerWallet(keysCfg.payerKP),
  });

  const gokiSDK = GokiSDK.load({ provider });
  const { tx, bufferAccount } = await gokiSDK.instructionBuffer.initBuffer(
    BUFFER_SIZE,
    keysCfg.smartWallet,
    new BN(-1),
    keysCfg.bufferAuthorityKP.publicKey,
    keysCfg.executorAuthorityKP.publicKey
  );
  tx.addSigners(keysCfg.bufferAuthorityKP, keysCfg.executorAuthorityKP);
  const pendingTx = await tx.send();
  const confirmedTx = await pendingTx.wait();
  confirmedTx.printLogs();

  console.log(
    JSON.stringify({ bufferAccount: bufferAccount.toString() }, null, 2)
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
