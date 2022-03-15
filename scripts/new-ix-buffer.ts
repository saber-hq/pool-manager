import { GokiSDK } from "@gokiprotocol/client";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, PACKET_DATA_SIZE } from "@solana/web3.js";
import { BN } from "bn.js";

import {
  BUFFER_AUTHORITY_KEYPAIR_PATH,
  BUFFER_EXECUTOR_KEYPAIR_PATH,
  PAYER_KEYPAIR_PATH,
  SMART_WALLET,
} from "./configs/keys";
import { RPC_URL } from "./configs/rpc";
import { readKeyfile } from "./helpers/readKeyfile";

const BUFFER_SIZE = 40 * PACKET_DATA_SIZE;

const main = async () => {
  const connection = new Connection(RPC_URL);
  const payerKP = readKeyfile(PAYER_KEYPAIR_PATH);

  const provider = SolanaProvider.init({
    connection,
    wallet: new SignerWallet(payerKP),
  });

  const authorityKP = readKeyfile(BUFFER_AUTHORITY_KEYPAIR_PATH);
  const executorKP = readKeyfile(BUFFER_EXECUTOR_KEYPAIR_PATH);
  const gokiSDK = GokiSDK.load({ provider });
  const { tx, bufferAccount } = await gokiSDK.instructionBuffer.initBuffer(
    BUFFER_SIZE,
    SMART_WALLET,
    new BN(-1),
    authorityKP.publicKey,
    executorKP.publicKey
  );
  tx.addSigners(authorityKP, executorKP);
  const pendingTx = await tx.send();
  await pendingTx.wait();

  JSON.stringify({ bufferAccount: bufferAccount.toString() }, null, 2);
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
