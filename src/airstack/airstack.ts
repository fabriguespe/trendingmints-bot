import { fetchQuery, init } from "@airstack/node";
import {
  TimeFrame,
  TrendingMintsCriteria,
  TrendingsMintsQuery,
} from "./airstack-types";
import { getRedisClient } from "../lib/redis.js";

init(process.env.AIRSTACK_API_KEY as string);
export const TRENDING_MINTS_QUERY_BASE =
  /* GraphQL */
  `
    query TrendingsMints(
      $timeFrame: TimeFrame!
      $criteria: TrendingMintsCriteria!
    ) {
      TrendingMints(
        input: {
          timeFrame: $timeFrame
          audience: all
          blockchain: base
          criteria: $criteria
        }
      ) {
        TrendingMint {
          address
          erc1155TokenID
          criteriaCount
          timeFrom
          timeTo
          token {
            name
            symbol
            type
            tokenNfts {
              tokenURI
              contentValue {
                image {
                  original
                  extraSmall
                  small
                  medium
                  large
                }
              }
              metaData {
                name
                description
              }
            }
          }
        }
      }
    }
  `;

interface QueryResponse {
  data: TrendingsMintsQuery | null;
  error: Error | null;
}

interface Error {
  message: string;
}

export const fetchTrendingMints = async (
  timeFrame: TimeFrame,
  criteria: TrendingMintsCriteria
) => {
  const redis = await getRedisClient();
  const REDIS_KEY_TRENDING_MINTS = "last-trending-mints";

  const cachedTrendingMints = await redis.get(REDIS_KEY_TRENDING_MINTS);

  if (cachedTrendingMints) {
    if (process.env.DEBUG == "true") {
      const nfts = JSON.parse(cachedTrendingMints);
      console.log(
        "Using cached trending mints",
        nfts[0].token?.tokenNfts?.[0].contentValue
      );
    }
    return JSON.parse(cachedTrendingMints);
  }

  const { data, error }: QueryResponse = await fetchQuery(
    TRENDING_MINTS_QUERY_BASE,
    {
      timeFrame,
      criteria,
    }
  );

  if (error) {
    console.error(error);
    process.exit(1);
  }

  if (
    !data ||
    !data.TrendingMints ||
    data.TrendingMints.TrendingMint?.length === 0
  ) {
    console.error("No trending mints found in timeframe:", timeFrame);
    return [];
  }

  const trendingMints = data.TrendingMints!.TrendingMint!;

  // Cache the data of the first NFT for each mint
  await Promise.all(
    trendingMints
      .filter((mint: any) => mint.address)
      .map(async (mint: any) => {
        const nft = mint.token?.tokenNfts?.[0];
        if (!nft) {
          console.error("No nft found for mint:", mint.address);
          return;
        }

        const cachedNft = await redis.get(mint.address!);
        if (cachedNft) {
          return;
        }

        const expireInThirtyDaysInSeconds = 60 * 60 * 24 * 30;
        await redis.setEx(
          mint.address!,
          expireInThirtyDaysInSeconds,
          JSON.stringify(nft)
        );
        return;
      })
  );

  const expireInOneDayInSeconds = 60 * 60 * 24;

  await redis.setEx(
    REDIS_KEY_TRENDING_MINTS,
    expireInOneDayInSeconds,
    JSON.stringify(trendingMints)
  );
  //await redis.set(REDIS_KEY_TRENDING_MINTS, JSON.stringify(trendingMints));
  return data.TrendingMints.TrendingMint;
};
