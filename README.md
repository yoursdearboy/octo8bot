# octo8bot

octo8bot sends GitHub pull request and branch push notifications to Telegram chats. The entire application runs as one Cloudflare Worker: Telegram calls `/telegram` when the bot joins a chat, and GitHub calls the chat-specific `/github` URL returned by the bot.

## Requirements

- Node.js 22 or newer
- A Cloudflare account
- A Telegram bot token from [BotFather](https://t.me/BotFather)

## Install and configure

Install the project dependencies:

```sh
npm install
```

Create a local secrets file from the example:

```sh
cp .dev.vars.example .dev.vars
```

Fill in the Telegram token and a random webhook secret. The webhook secret must contain only letters, numbers, underscores, or hyphens and be at most 256 characters. `.dev.vars` is also used for local development and is ignored by Git.

## Deploy

On the first deployment, upload both required secrets with the Worker:

```sh
npx wrangler deploy --secrets-file .dev.vars
```

For later code-only deployments, use:

```sh
npm run deploy
```

Wrangler prints the deployed Worker URL. Register that URL with Telegram, supplying the same values used for the Cloudflare secrets:

```sh
TELEGRAM_TOKEN='123:abc' \
TELEGRAM_WEBHOOK_SECRET='your-random-secret' \
npm run telegram:set-webhook -- https://octo8bot.example.workers.dev
```

The setup command configures Telegram to deliver `my_chat_member` updates to `/telegram` and authenticates them with the secret header.

## Connect a Telegram chat to GitHub

Add the bot to a Telegram group. The bot replies with a URL similar to:

```text
https://octo8bot.example.workers.dev/github?chat_id=-1001234567890
```

In the GitHub repository:

1. Open **Settings → Webhooks → Add webhook**.
2. Paste the URL as the **Payload URL**.
3. Select `application/json` as the content type.
4. Select individual events and enable **Pull requests** and **Pushes**.
5. Save the webhook.

The GitHub endpoint intentionally preserves the original bot's open, chat-ID-based behavior and does not require a webhook secret. Anyone who knows a chat's webhook URL can submit events to it, so keep the URL private.

Push notifications are sent for commit-bearing branch pushes. Tag pushes, branch creation, branch deletion, and pushes without commits are ignored. A notification includes up to 10 commits and links to the full GitHub comparison.

## Development commands

```sh
npm run dev             # run the Worker locally
npm run check           # type-check TypeScript
npm run deploy:dry-run  # build without deploying
npm run cf-typegen      # generate Cloudflare binding/runtime types
```
