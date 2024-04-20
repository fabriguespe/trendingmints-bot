import "dotenv/config";
import HandlerContext from "./lib/handler-context";
import run from "./lib/runner.js";
import { getRedisClient } from "./lib/redis.js";
import { Preference } from "./types.js";
import { TimeFrame } from "./airstack/airstack-types.js";
import {
  fetchAndSendTrendingMints,
  fetchAndSendTrendingMintsInContext,
} from "./cron.js";

import cron from "node-cron";
import Mixpanel from "mixpanel";
const mixpanel = Mixpanel.init(process.env.MIX_PANEL as string);

const inMemoryCache = new Map<
  string,
  { step: number; lastInteraction: number }
>();

run(async (context: HandlerContext) => {
  const { message } = context;
  const { content, senderAddress } = message;

  mixpanel.track("Page Viewed", {
    distinct_id: senderAddress,
  });
  const redisClient = await getRedisClient();

  const oneHour = 3600000; // Milliseconds in one hour.
  const now = Date.now(); // Current timestamp.
  const cacheEntry = inMemoryCache.get(senderAddress); // Retrieve the current cache entry for the sender.
  let reset = false; // Flag to indicate if the interaction step has been reset.
  const defaultStopWords = ["stop", "unsubscribe", "cancel"];
  if (defaultStopWords.some((word) => content.toLowerCase().includes(word))) {
    // If its a stop word
    // unsubscribe the user
    const deleteResult = await redisClient.del("pref-" + senderAddress);
    if (deleteResult) {
      await context.reply(
        "You unsubscribed successfully. You can always subscribe again by sending a message."
      );
    } else {
      await context.reply(
        "You are now subscribed to the bot yet. You can subscribe by sending a message and selecting the correct option."
      );
    }

    reset = true;
  }
  if (!cacheEntry || now - cacheEntry.lastInteraction > oneHour) {
    // If there's no cache entry or the last interaction was more than an hour ago, reset the step.
    // reset = true;
  }
  inMemoryCache.delete(senderAddress);
  // Update the cache entry with either reset step or existing step, and the current timestamp.
  inMemoryCache.set(senderAddress, {
    step: reset ? 0 : cacheEntry?.step ?? 0,
    lastInteraction: now,
  });

  const step = inMemoryCache.get(senderAddress)?.step;

  if (reset) return;
  if (!step) {
    // send the first message

    const existingSubscription = await redisClient.get(`pref-${senderAddress}`);

    if (existingSubscription) {
      await context.reply(
        "You are already subscribed. If you wish to stop receiving updates, you can unsubscribe at any time by sending 'stop' or update your options."
      );
    } else {
      await context.reply(
        "Welcome to the trendingmints bot where you get instant alerts when mints start trending."
      );
    }
    // send the second message
    await context.reply(
      "How often would you like me to send you new mints?\n\n1️⃣ Right away - let me know once it starts trending;\n2️⃣ Once a day - send me the top 2 of the day.\n\n✍️ (reply with 1 or 2)"
    );

    inMemoryCache.set(senderAddress, { step: 1, lastInteraction: now });
  } else if (step === 1) {
    if (
      content !== Preference.RIGHT_AWAY &&
      /*content !== Preference.EVERY_FEW_HOURS &&*/
      content !== Preference.ONCE_A_DAY
    ) {
      await context.reply(
        "Invalid option selected. Please enter a valid option (1 or 2)\n\nIf you'd like to restart the bot,  you can do so at any time by saying 'stop'."
      );
      return;
    }

    if (content === Preference.RIGHT_AWAY) {
      await context.reply("Great. You're all set.");
      await context.reply(
        "I'll grab you the top 2 trending today, and send them your way. Give me a few minutes."
      );
      inMemoryCache.set(senderAddress, {
        step: 0,
        lastInteraction: Date.now(),
      });
    } else if (content === Preference.ONCE_A_DAY) {
      // store the user's preference
      await redisClient.set(`pref-${senderAddress}`, content);
      await context.reply("Great. You're all set.");
      await context.reply(
        "Since you're just getting caught up, I'll grab you the top 2 trending today, and send them your way. Give me a few minutes."
      );
      await context.reply(
        "Also, if you'd like to unsubscribe, you can do so at any time by saying 'stop'."
      );

      mixpanel.track("Subscribed", {
        distinct_id: senderAddress,
        preference: content,
      });
      inMemoryCache.set(senderAddress, {
        step: 0,
        lastInteraction: Date.now(),
      });
    }

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
    () => fetchAndSendTrendingMints(TimeFrame.OneHour),
    {
      runOnInit: false,
    }
  );
}

// Run the cron job every hour
cron.schedule("0 * * * *", () => fetchAndSendTrendingMints(TimeFrame.OneHour), {
  runOnInit: false,
});

// Run the cron job every 2 hours
cron.schedule(
  "0 */2 * * *",
  () => fetchAndSendTrendingMints(TimeFrame.OneHour),
  {
    runOnInit: false,
  }
);

// Run the cron job every day
cron.schedule(
  "0 18 * * *",
  () => fetchAndSendTrendingMints(TimeFrame.OneHour),
  {
    runOnInit: false,
    timezone: "Europe/Rome",
  }
);
