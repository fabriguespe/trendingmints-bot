import { privateKeyToAccount } from "viem/accounts";
import HandlerContext from "./handler-context";
import run from "./runner";

const inMemoryCache = new Map<string, number>();

run(async (context: HandlerContext) => {
  const { message } = context;
  const wallet = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  const { content, senderAddress } = message;

  if (senderAddress.toLowerCase() === wallet.address.toLowerCase()) {
    // safely ignore this message
    return;
  }

  // get the current step we're in
  const step = inMemoryCache.get(senderAddress);

  // check if the message is an unsubscribe message
  if (
    content.toLowerCase() === "stop" ||
    content.toLowerCase() === "unsubscribe"
  ) {
    // unsubscribe the user
    // TODO: unsubscribe the user from Redis DB
  }

  if (!step) {
    // send the first message
    await context.reply(
      "Welcome to the trendingmints bot where you get instant alerts when mints start trending."
    );
    // send the second message
    await context.reply(
      "How often would you like me to send you new mints?\n\n1. Right away - let me know once it starts trending;\n2. Every few hours - keep me updated;\n3.Once a day - send me the top 5 of the day."
    );

    inMemoryCache.set(senderAddress, 1);
  } else if (step === 1) {
    if (
      content !== "1" &&
      content !== "2" &&
      content !== "3" &&
      content !== "4"
    ) {
      await context.reply(
        "Invalid option selected. Please enter a valid option (1, 2, 3, 4)"
      );
      return;
    }

    // TODO: set the user preference in the Redis DB

    await context.reply("Great. You're all set.");
    await context.reply(
      "Since you're just getting caught up, I'll grab you the top 5 trending today, and send them your way. Give me a few minutes."
    );
    await context.reply(
      "Also, if you'd like to unsubscribe, you can do so at any time by saying 'stop' or 'unsubscribe'."
    );
  }
});
