import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import HandlerContext from "./handler-context";
import run from "./runner.js";
import { getRedisClient } from "./lib/redis.js";
import { Preference } from "./types.js";
import { TimeFrame } from "./lib/airstack-types.js";
import {
  fetchAndSendTrendingMints,
  fetchAndSendTrendingMintsInContext,
} from "./cron.js";
import cron from "node-cron";

const inMemoryCache = new Map<string, number>();

run(async (context: HandlerContext) => {
  const { message } = context;
  const wallet = privateKeyToAccount(process.env.KEY as `0x${string}`);

  const { content, senderAddress } = message;

  if (senderAddress?.toLowerCase() === wallet.address?.toLowerCase()) {
    // safely ignore this message
    return;
  }

  const redisClient = await getRedisClient();

  // get the current step we're in
  const step = inMemoryCache.get(senderAddress);

  // check if the message is an unsubscribe message
  if (
    content?.toLowerCase() === "stop" ||
    content?.toLowerCase() === "unsubscribe"
  ) {
    // unsubscribe the user
    await redisClient.del(senderAddress);
  }

  if (!step) {
    // send the first message
    await context.reply(
      "Welcome to the trendingmints bot where you get instant alerts when mints start trending."
    );
    // send the second message
    await context.reply(
      "How often would you like me to send you new mints?\n\n1️⃣ Right away - let me know once it starts trending;\n2️⃣ Every few hours - keep me updated;\n3️⃣ Once a day - send me the top 5 of the day.\n\n✍️ (reply with 1, 2 or 3)"
    );

    inMemoryCache.set(senderAddress, 1);
  } else if (step === 1) {
    if (
      content !== Preference.RIGHT_AWAY &&
      content !== Preference.EVERY_FEW_HOURS &&
      content !== Preference.ONCE_A_DAY
    ) {
      await context.reply(
        "Invalid option selected. Please enter a valid option (1, 2 or 3)"
      );
      return;
    }

    // store the user's preference
    await redisClient.set(`pref-${senderAddress}`, content);

    await context.reply("Great. You're all set.");
    await context.reply(
      "Since you're just getting caught up, I'll grab you the top 5 trending today, and send them your way. Give me a few minutes."
    );
    await context.reply(
      "Also, if you'd like to unsubscribe, you can do so at any time by saying 'stop' or 'unsubscribe'."
    );

    await fetchAndSendTrendingMintsInContext(
      TimeFrame.OneHour,
      context,
      redisClient
    );
  }
});

if (process.env.DEBUG === "true") {
  console.log("Running in debug mode");
  // Run the cron job every 5 seconds
  // Run the cron job every hour
  cron.schedule(
    "*/10 * * * * *",
    fetchAndSendTrendingMints(TimeFrame.OneHour) as any,
    {
      runOnInit: false,
    }
  );
}

// Run the cron job every hour
cron.schedule(
  "0 * * * *",
  fetchAndSendTrendingMints(TimeFrame.OneHour) as any,
  {
    runOnInit: false,
  }
);

// Run the cron job every 2 hours
cron.schedule(
  "0 */2 * * *",
  fetchAndSendTrendingMints(TimeFrame.OneHour) as any,
  {
    runOnInit: false,
  }
);

// Run the cron job every day
cron.schedule(
  "0 12 * * *",
  fetchAndSendTrendingMints(TimeFrame.OneHour) as any,
  {
    runOnInit: false,
  }
);
