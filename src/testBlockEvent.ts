import { TransactionEvent, Block, BlockEvent } from "forta-bot";
import { createAddress } from "forta-agent-tools";

export class TestBlockEvent extends BlockEvent {
  constructor() {
    const chainId: number = 1;
    const block: Block = {
      transactions: [],
      hash: createAddress("0x0"),
      number: 0,
    } as any;

    super(chainId, block);
  }

  public setNumber(blockNumber: number): TestBlockEvent {
    this.block.number = blockNumber;
    return this;
  }

  public setHash(blockHash: string): TestBlockEvent {
    this.block.hash = blockHash;
    return this;
  }

  public setTimestamp(timestamp: number): TestBlockEvent {
    this.block.timestamp = timestamp;
    return this;
  }

  public addTransactions(...txns: TransactionEvent[]): TestBlockEvent {
    this.block.transactions.push(...txns.map((tx) => tx.hash));
    return this;
  }

  public addTransactionsHashes(...hashes: string[]): TestBlockEvent {
    this.block.transactions.push(...hashes);
    return this;
  }
}
