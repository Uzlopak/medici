import * as mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Book, initModels } from "../src";
import * as Benchmark from "benchmark";

// @ts-ignore
const suite = new Benchmark.Suite();
let replSet: MongoMemoryReplSet;

function p(fn) {
  return {
    defer: true,
    async fn(deferred) {
      await fn();
      deferred.resolve();
    }
  }
}

(async () => {
  replSet = new MongoMemoryReplSet({
    binary: {
      version: "4.2.5",
    },
    instanceOpts: [
      // Set the expire job in MongoDB to run every second
      { args: ["--setParameter", "ttlMonitorSleepSecs=1"] },
    ],
    replSet: {
      name: "rs0",
      storageEngine: "wiredTiger",
    },
  });
  replSet.start();
  await replSet.waitUntilRunning();
  const connectionString = replSet.getUri();
  await mongoose.connect(connectionString, {
    bufferCommands: false,
    noDelay: true,
  });

  await initModels();

  const book = new Book("MyBook");

  for (let i = 0; i < 5000; i++) {
    await book
      .entry(`Test Entry ${i}`)
      .debit("Assets:Receivable", 700)
      .credit("Income:Rent", 700)
      .commit();
  }
  

  suite
    .add('balance', p(async () => {
      await book.balance({
        account: "Income:Rent",
      });
    }))
    .on('cycle', (event) => {
        console.log(String(event.target));
    })
    .run();
  process.exit(0);
})();
