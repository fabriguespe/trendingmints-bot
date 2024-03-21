import { fetchQuery, init } from "@airstack/node";
import {
  TimeFrame,
  TrendingMintsCriteria,
  TrendingsMintsQuery,
} from "./airstack-types";

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
              contentValue {
                image {
                  original
                  medium
                  large
                  extraSmall
                  small
                }
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

  return data.TrendingMints.TrendingMint;
};
