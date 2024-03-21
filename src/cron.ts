import { fetchTrendingMints } from "./lib";
import createClient from "./client";

import { Cron } from "croner";
import { TimeFrame, TrendingMintsCriteria } from "./lib/airstack-types";
import { getRedisClient } from "./redis";
import { Preference } from "./types";

// run every 1 hr
Cron("*/5 * * * * *", async () => {
  const xmtpClient = await createClient();
  const redisClient = await getRedisClient();

  const trendingMints = await fetchTrendingMints(
    TimeFrame.OneHour,
    TrendingMintsCriteria.TotalMints
  );

  if (!trendingMints || trendingMints.length === 0) {
    console.log("No trending mints found");
    return;
  }

  const conversations = await xmtpClient.conversations.list();

  for await (const conversation of conversations) {
    const userPreference = await redisClient.get(
      `pref-${conversation.peerAddress}`
    );

    if (!userPreference || userPreference !== Preference.RIGHT_AWAY) {
      continue;
    }

    await conversation.send("🚀 New mints are trending! Check them out now.");
    await conversation.send(
      trendingMints.map((mint: any) => mint.token?.name).join("\n")
    );
  }
});
