import { fetchTrendingMints } from "./airstack/airstack.js";
import { TimeFrame, TrendingMintsCriteria } from "./airstack/airstack-types.js";
import { getRedisClient } from "./lib/redis.js";
import { Preference } from "./types.js";
import { run, xmtpClient, HandlerContext } from "@xmtp/botkit";

import {
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from "@redis/client";

const mapTimeFrameToPreference = (timeFrame: TimeFrame) => {
  switch (timeFrame) {
    case TimeFrame.OneDay:
      return Preference.ONCE_A_DAY;
  }
};

export const fetchAndSendTrendingMintsInContext = async (
  timeFrame: TimeFrame,
  context: HandlerContext,
  redisClient: RedisClientType<RedisModules, RedisFunctions, RedisScripts>
) => {
  // Fetch trending mints from Airstack
  const trendingMints = await fetchTrendingMints(
    timeFrame,
    TrendingMintsCriteria.UniqueWallets
  );

  // If no trending mints are found, log and return
  if (!trendingMints || trendingMints.length === 0) {
    console.log("No trending mints found");
    return;
  }

  const mintsToSend = trendingMints
    .filter((mint) => mint.address) // Ensure we only consider mints with an address
    .sort(() => 0.5 - Math.random()) // Shuffle the array
    .slice(0, 2); // Take the first 2 items from the shuffled array
  // Store the last mints for the user

  const mintsToSendAddresses = mintsToSend.map((mint) => mint.address!);
  await redisClient.set(
    `last-mints-${context.message.conversation.peerAddress}`,
    JSON.stringify(Array.from(new Set([...mintsToSendAddresses])))
  );

  await context.reply(
    "🚀 Here some trending mints to give you a taste of what I can do! Check them out now."
  );

  if (process.env.DEBUG === "true") {
    console.log("mints to send", mintsToSend);
  }
  await Promise.all(
    mintsToSend.map((mint) =>
      context.reply(
        `${process.env.PUBLIC_FRAME_URL}?chain=base&a=${mint.address}&c=${mint.criteriaCount}`
      )
    )
  );
};

export const fetchAndSendTrendingMints = async (timeFrame: TimeFrame) => {
  // Instantiate clients
  const client = await xmtpClient();
  const redisClient = await getRedisClient();

  // Fetch trending mints from Airstack
  const trendingMints = await fetchTrendingMints(
    timeFrame,
    TrendingMintsCriteria.UniqueWallets
  );

  // If no trending mints are found, log and return
  if (!trendingMints || trendingMints.length === 0) {
    console.log("No trending mints found");
    return;
  }

  // Fetch open conversations aka all the addresses that have interacted with the bot
  const conversations = await client.conversations.list();

  // Iterate over each conversation
  for await (const conversation of conversations) {
    // Fetch user preference from Redis
    const userPreference = await redisClient.get(
      `pref-${conversation.peerAddress}`
    );

    // If user preference is not set or does not match the current timeframe, skip
    if (
      !userPreference ||
      userPreference !== mapTimeFrameToPreference(timeFrame)
    ) {
      continue;
    }

    // Send trending mints to user
    await conversation.send("🚀 New mints are trending! Check them out now.");

    // Check if the user has already received the first send
    const firstSend = await redisClient.get(
      `first-send-${conversation.peerAddress}`
    );
    // If use has not received the first send, send 2 mints, else send 2
    const amount = 2;

    if (!firstSend) {
      // Toggle the first send for the user
      await redisClient.set(`first-send-${conversation.peerAddress}`, "true");
    }
    // Get the last mints sent to the user
    const lastMintsSent = await redisClient.get(
      `last-mints-${conversation.peerAddress}`
    );
    // Parse the last mints sent JSON array (or return an empty array)
    const parsedLastMints = lastMintsSent
      ? (JSON.parse(lastMintsSent) as string[])
      : [];

    // Filter the mints to send to the user
    const mintsToSend = trendingMints.filter((mint) => {
      if (!lastMintsSent || lastMintsSent.length === 0) return true;
      return !parsedLastMints.includes(mint.address!);
    });

    // Skip if no mints to send
    if (mintsToSend.length === 0) {
      continue;
    }

    // Get the slice
    const mintsToSendSlice = mintsToSend.slice(0, amount);

    // Store the last mints for the user
    const mintsToSendAddresses = mintsToSendSlice.map((mint) => mint.address!);
    await redisClient.set(
      `last-mints-${conversation.peerAddress}`,
      JSON.stringify(
        Array.from(new Set([...mintsToSendAddresses, ...parsedLastMints]))
      )
    );
    await Promise.all(
      mintsToSendSlice.map((mint) =>
        conversation.send(
          `${process.env.PUBLIC_FRAME_URL}?chain=base&a=${mint.address}&c=${mint.criteriaCount}`
        )
      )
    );
  }
};
