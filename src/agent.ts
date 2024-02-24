import {
  getChainId,
  Finding,
  HandleTransaction,
  TransactionEvent,
  HandleBlock,
  BlockEvent,
  Initialize,
  scanBase,
  scanEthereum,
  runHealthCheck,
  ethers,
} from "forta-bot";

const provider = new ethers.JsonRpcProvider();
import transferMismatch, { mints } from "./transfer.mismatch";
import approveMismatch from "./approve.mismatch";
import { PersistenceHelper } from "./persistence.helper";

const ONE_DAY = 24 * 60 * 60;
const TIME_PERIOD_DAYS = 30;
const TIME_PERIOD = TIME_PERIOD_DAYS * ONE_DAY;

let chainId: string;

const DATABASE_URL = "https://research.forta.network/database/bot/";

const DB_KEY = "nm-nft-sleep-minting-key";

export let counter: Record<string, number> = {
  nftApprovals: 0,
  nftTransfers: 0,
  sleepMint1Alerts: 0,
  sleepMint2Alerts: 0,
  sleepMint3Alerts: 0,
};

export const provideInitialize = (persistenceHelper: PersistenceHelper): Initialize => {
  return async () => {
    const chainIdValue = getChainId();

    if (chainIdValue !== undefined) {
      chainId = chainIdValue.toString();
      console.log("chain id is:", chainId);
    } else {
      console.log("chain id is undefined");
      throw new Error("Chain ID is undefined");
    }

    counter = await persistenceHelper.load(DB_KEY.concat("-", chainId));
  };
};

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  let findings: Finding[] = [];

  findings = (
    await Promise.all([
      transferMismatch.handleTransaction(txEvent, provider),
      approveMismatch.handleTransaction(txEvent, provider),
    ])
  ).flat();

  return findings;
};

let lastTimestamp = 0;

export const provideHandleBlock =
  (persistenceHelper: PersistenceHelper, mints: Record<string, [string, string, number][]>): HandleBlock =>
  async (blockEvent: BlockEvent) => {
    const { timestamp: blockTimestamp, number } = blockEvent.block;

    if (number % 240 === 0) {
      await persistenceHelper.persist(counter, DB_KEY.concat("-", chainId));
      console.log(`Stored minters length on chainId ${Number(blockEvent.network)} is ${Object.keys(mints).length}`);
    }

    if (blockTimestamp - lastTimestamp > TIME_PERIOD) {
      for (const [key, values] of Object.entries(mints)) {
        for (let i = 0; i < values.length; i++) {
          const [, , timestamp] = values[i];
          if (blockTimestamp - timestamp > TIME_PERIOD) {
            values.splice(i, 1);
            i--;
          }
        }

        if (mints[key].length === 0) {
          delete mints[key];
        }
      }
    }
    lastTimestamp = blockTimestamp;

    return [];
  };

async function main() {
  const initialize = provideInitialize(new PersistenceHelper(DATABASE_URL));
  const handleBlock = provideHandleBlock(new PersistenceHelper(DATABASE_URL), mints);

  await initialize();

  scanBase({
    rpcUrl: "https://base-mainnet.g.alchemy.com/v2",
    rpcKeyId: "ff890297-bee3-41a6-b985-1e68cdc78f7c",
    localRpcUrl: "8453",
    handleTransaction,
    handleBlock,
  });

  scanEthereum({
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2",
    rpcKeyId: "64286df1-4567-405a-a102-1122653022e4",
    localRpcUrl: "1",
    handleTransaction,
    handleBlock,
  });

  runHealthCheck();
}

if (require.main === module) {
  main();
}

export default {
  initialize: provideInitialize(new PersistenceHelper(DATABASE_URL)),
  handleTransaction,
  handleBlock: provideHandleBlock(new PersistenceHelper(DATABASE_URL), mints),
  resetLastTimestamp: () => {
    lastTimestamp = 0; // Used in unit tests
  },
};
