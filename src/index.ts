import { run, HandlerContext } from "@xmtp/message-kit";
import { getRedisClient } from "./lib/redis.js";
import { TimeFrame } from "./airstack/airstack-types.js";
import cron from "node-cron";
import { Preference } from "./lib/types.js";
import {
  fetchAndSendTrendingMints,
  fetchAndSendTrendingMintsInContext,
} from "./lib/cron.js";

import Mixpanel from "mixpanel";
const mixpanel = Mixpanel.init(process.env.MIX_PANEL as string);

//Tracks conversation steps
const inMemoryCacheStep = new Map<string, number>();
async function start() {
  const redisClient = await getRedisClient();
  run(async (context: HandlerContext) => {
    const {
      message: {
        content: { content: text },
        typeId,
        sender,
      },
    } = context;

    if (typeId !== "text") return;

    mixpanel.track("TrendingMints-Visit", {
      distinct_id: sender.address,
    });

    const defaultStopWords = ["stop", "unsubscribe", "cancel", "list"];
    if (defaultStopWords.some((word) => text.toLowerCase().includes(word))) {
      // If its a stop word
      // unsubscribe the user
      const deleteResult = await redisClient.del("pref-" + sender.address);
      if (deleteResult) {
        await context.send("ha");
        await context.send(
          "You unsubscribed successfully. You can always subscribe again by sending a message."
        );
      } else {
        await context.send(
          "You are not subscribed to the bot yet. You can subscribe by sending a message and selecting the correct option."
        );
      }
      inMemoryCacheStep.set(sender.address, 0);
      return;
    }

    const cacheStep = inMemoryCacheStep.get(sender.address) || 0;
    if (cacheStep === 0) {
      // send the first message

      const existingSubscription = await redisClient.get(
        `pref-${sender.address}`
      );

      if (existingSubscription) {
        await context.send(
          "You are already subscribed. If you wish to stop receiving updates, you can unsubscribe at any time by sending 'stop' or update your options."
        );
      } else {
        await context.send(
          "Welcome to the trendingmints bot where you get instant alerts when mints start trending."
        );
      }
      // send the second message
      await context.send(
        "How often would you like me to send you new mints?\n\n1️⃣ Right away - let me know once it starts trending;\n2️⃣ Once a day - send me the top 2 of the day.\n\n✍️ (reply with 1 or 2)"
      );

      inMemoryCacheStep.set(sender.address, 1);
    } else if (cacheStep === 1) {
      if (text !== Preference.RIGHT_AWAY && text !== Preference.ONCE_A_DAY) {
        await context.send(
          "Invalid option selected. Please enter a valid option (1 or 2)\n\nIf you'd like to restart the bot,  you can do so at any time by saying 'stop'."
        );
        return;
      }

      if (text === Preference.RIGHT_AWAY) {
        await context.send("Great. You're all set.");
        await context.send(
          "I'll grab you the top 2 trending today, and send them your way. Give me a few minutes."
        );
        inMemoryCacheStep.set(sender.address, 0);
      } else if (text === Preference.ONCE_A_DAY) {
        // store the user's preference
        await redisClient.set(`pref-${sender.address}`, text);
        await context.send("Great. You're all set.");
        await context.send(
          "Since you're just getting caught up, I'll grab you the top 2 trending today, and send them your way. Give me a few minutes."
        );
        await context.send(
          "Also, if you'd like to unsubscribe, you can do so at any time by saying 'stop'."
        );

        mixpanel.track("TrendingMints-Subscribed", {
          distinct_id: sender.address,
        });
        inMemoryCacheStep.set(sender.address, 0);
      }

      await fetchAndSendTrendingMintsInContext(
        TimeFrame.OneDay,
        context,
        sender.address,
        redisClient
      );
    }
  });

  // Run the cron job every day
  cron.schedule(
    "0 18 * * *",
    () => fetchAndSendTrendingMints(TimeFrame.OneDay),
    {
      runOnInit: false,
      timezone: "Europe/Rome",
    }
  );
}

start();
