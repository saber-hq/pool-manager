import { GokiSDK } from "@gokiprotocol/client";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { Connection, PACKET_DATA_SIZE, PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

import { readKeyfile } from "./readKeyfile";

const DEFAULT_KEYFILE = "~/.config/solana/id.json";

const PAYER_KEYPAIR_PATH = process.env.PAYER_KEYFILE ?? DEFAULT_KEYFILE;
const BUFFER_AUTHORITY_KEYPAIR_PATH =
  process.env.BUFFER_AUTHORITY_KEYFILE ?? DEFAULT_KEYFILE;
const BUFFER_EXECUTOR_KEYPAIR_PATH =
  process.env.BUFFER_EXECUTOR_KEYFILE ?? DEFAULT_KEYFILE;
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const BUFFER_SIZE = 40 * PACKET_DATA_SIZE;
const SMART_WALLET = PublicKey.default;

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
