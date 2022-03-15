// import { GokiSDK } from "@gokiprotocol/client";
// import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
// import { Connection } from "@solana/web3.js";
import * as axios from "axios";

// import { PoolManagerSDK } from "../src";
// import { PAYER_KEYPAIR_PATH, POOL_MANAGER } from "./configs/keys";
import { NETWORK } from "./configs/rpc";
// import { readKeyfile } from "./helpers/readKeyfile";

const main = async () => {
  // const connection = new Connection(RPC_URL);
  // const payerKP = readKeyfile(PAYER_KEYPAIR_PATH);

  // const provider = SolanaProvider.init({
  //   connection,
  //   wallet: new SignerWallet(payerKP),
  // });
  //const gokiSDK = GokiSDK.load({ provider });
  // const pmSDK = PoolManagerSDK.load({ provider });

  const resp = await axios.default.get<unknown>(
    `https://registry.saber.so/data/pools-info.${NETWORK}.json`
  );
  const registryData = resp.data;

  console.log(registryData);
  // const pm = await pmSDK.loadManager(POOL_MANAGER);
  return null;
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
