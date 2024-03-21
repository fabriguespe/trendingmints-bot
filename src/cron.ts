import { fetchTrendingMints } from "./lib/airstack.js";
import createClient from "./client.js";

import { TimeFrame, TrendingMintsCriteria } from "./lib/airstack-types.js";
import { getRedisClient } from "./redis.js";
import { Preference } from "./types.js";

const mapTimeFrameToPreference = (timeFrame: TimeFrame) => {
  switch (timeFrame) {
    case TimeFrame.OneDay:
      return Preference.ONCE_A_DAY;
    case TimeFrame.TwoHours:
      return Preference.EVERY_FEW_HOURS;
    case TimeFrame.OneHour:
      return Preference.RIGHT_AWAY;
  }
};

export const fetchAndSendTrendingMints = async (timeFrame: TimeFrame) => {
  // Instantiate clients
  const xmtpClient = await createClient();
  const redisClient = await getRedisClient();

  // Fetch trending mints from Airstack
  const trendingMints = await fetchTrendingMints(
    timeFrame,
    TrendingMintsCriteria.TotalMints
  );

  // If no trending mints are found, log and return
  if (!trendingMints || trendingMints.length === 0) {
    console.log("No trending mints found");
    return;
  }

  // Fetch open conversations aka all the addresses that have interacted with the bot
  const conversations = await xmtpClient.conversations.list();

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

    // TODO:
    // instead of sending the message in text format, for each trending mint send a message with a custom frame link
    // https://mint.builders.garden/<chain>/<contractAddress> ---> we need to create this frame
    // the frame should have the mint's image, name, and number of trending mints
    // a single button that redirects to https://zora.co/collect/<chain>:<contractAddress>
    await conversation.send(
      trendingMints
        // TODO: filter out trending mints that where already sent in previous messages
        .filter(Boolean)
        .slice(0, 5)
        .map((mint) =>
          [
            mint.token!.name,
            mint.token?.tokenNfts![0].contentValue?.image?.medium,
            mint.criteriaCount,
          ].join(" - ")
        )
        .join("\n")
    );
  }
};
