import createClient from "./client";
import HandlerContext from "./handler-context";

type Handler = (message: HandlerContext) => Promise<void>;

export default async function run(handler: Handler) {
  const client = await createClient();

  console.log(`Listening on ${client.address}`);

  for await (const message of await client.conversations.streamAllMessages(
    () => {
      console.log("connection lost");
    }
  )) {
    console.log(`Got a message`, message);

    try {
      if (message.senderAddress == client.address) {
        continue;
      }

      const context = new HandlerContext(message);

      await handler(context);
    } catch (e) {
      console.log(`error`, e, message);
    }
  }
}
