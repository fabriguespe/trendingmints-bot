import { init } from "@airstack/node";

init(process.env.AIRSTACK_API_KEY as string);

export const TRENDING_MINTS_QUERY_BASE = `
query MyQuery(
    $timeFrame: TimeFrame!,
    $criteria: TrendingMintsCriteria!
  ) {
    TrendingMints(
      input: {
        timeFrame: $timeFrame,
        audience: all,
        blockchain: base,
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
        }
      }
    }
  }
`;
