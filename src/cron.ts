import { fetchQuery } from "@airstack/node";
import { TRENDING_MINTS_QUERY_BASE } from "./lib";
import createClient from "./client";

const execute = async () => {
  const { data, error } = await fetchQuery(TRENDING_MINTS_QUERY_BASE, {
    timeFrame: "one_hour",
    criteria: "unique_wallets",
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const xmtpClient = await createClient();

  // TODO: retrieve users from the database and send them a message
  // if it's the first delivery to the user, send the top 5 trending
  // if it's not the first delivery to the user, send the new trending only if it matches their preference
};

execute();
