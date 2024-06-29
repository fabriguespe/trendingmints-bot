# Trendingmints Bot 🚀

> 💬 **Try it:** Message `trendingmints.eth`

## Development

To kickstart the tutorial, you'll need to clone the repository containing the bot code. Follow these steps:

```bash
git clone https://github.com/fabriguespe/trendingmints-bot.git
cd trendingmints-bot
# copy env variables template
cp .env.example .env
```

**Set the variables**

```bash
KEY= # the private key of the bot
XMTP_ENV= #the xmtp network production or dev
AIRSTACK_API_KEY= # your Airstack API key
REDIS_CONNECTION_STRING= # redis connection string for caching
PUBLIC_FRAME_URL= # deployed vercel frame url
MIX_PANEL= # mixpanel key
```

**Run the bot**

```bash
# install dependencies
yarn install

# to run with hot-reload
yarn build:watch
yarn start:watch
```

## Messaging apps 💬

Test the bots in messaging apps

- [Converse](https://getconverse.app/): Own your conversations. Works with Frames (Transactions TBA)
- [Coinbase Wallet](https://www.coinbase.com/wallet): Your key to the world of crypto. (Frame support TBA)

## Documentation 📚

To learn more about Botkit, to go the [docs](https://github.com/xmtp/botkit)
