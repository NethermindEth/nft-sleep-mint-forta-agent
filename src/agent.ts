import {
  Finding,
  HandleTransaction,
  TransactionEvent,
  HandleBlock,
  BlockEvent,
  ethers,
  Initialize,
  getEthersProvider,
} from "forta-agent";

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

export const provideInitialize = (
  provider: ethers.providers.Provider,
  persistenceHelper: PersistenceHelper
): Initialize => {
  return async () => {
    chainId = (await provider.getNetwork()).chainId.toString();
    counter = await persistenceHelper.load(DB_KEY.concat("-", chainId));
  };
};

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  let findings: Finding[] = [];

  findings = (
    await Promise.all([transferMismatch.handleTransaction(txEvent), approveMismatch.handleTransaction(txEvent)])
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

export default {
  initialize: provideInitialize(getEthersProvider(), new PersistenceHelper(DATABASE_URL)),
  handleTransaction,
  handleBlock: provideHandleBlock(new PersistenceHelper(DATABASE_URL), mints),
  resetLastTimestamp: () => {
    lastTimestamp = 0; // Used in unit tests
  },
};
