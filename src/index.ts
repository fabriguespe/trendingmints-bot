import "dotenv/config";
import { run, HandlerContext } from "@xmtp/botkit";
import { getRedisClient, getRedisConfig } from "./lib/redis.js";
import { TimeFrame } from "./airstack/airstack-types.js";
import cron from "node-cron";
import { Preference } from "./types.js";
import {
  fetchAndSendTrendingMints,
  fetchAndSendTrendingMintsInContext,
} from "./cron.js";

import Mixpanel from "mixpanel";
const mixpanel = Mixpanel.init(process.env.MIX_PANEL as string);

//Tracks conversation steps
const inMemoryCacheStep = new Map<string, number>();
async function start() {
  const redisClient = await getRedisClient();
  const newBotConfig = await getRedisConfig(redisClient);
  run(async (context: HandlerContext) => {
    const { message } = context;
    const { content, senderAddress } = message;

    mixpanel.track("TrendingMints-Visit", {
      distinct_id: senderAddress,
    });

    const defaultStopWords = ["stop", "unsubscribe", "cancel", "list"];
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
          "You are not subscribed to the bot yet. You can subscribe by sending a message and selecting the correct option."
        );
      }
      inMemoryCacheStep.set(senderAddress, 0);
      return;
    }

    const cacheStep = inMemoryCacheStep.get(senderAddress) || 0;
    if (cacheStep === 0) {
      // send the first message

      const existingSubscription = await redisClient.get(
        `pref-${senderAddress}`
      );

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

      inMemoryCacheStep.set(senderAddress, 1);
    } else if (cacheStep === 1) {
      if (
        content !== Preference.RIGHT_AWAY &&
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
        inMemoryCacheStep.set(senderAddress, 0);
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

        mixpanel.track("TrendingMints-Subscribed", {
          distinct_id: senderAddress,
        });
        inMemoryCacheStep.set(senderAddress, 0);
      }

      await fetchAndSendTrendingMintsInContext(
        TimeFrame.OneDay,
        context,
        redisClient
      );
    }
  }, newBotConfig);

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
