const [workerUrlArgument] = process.argv.slice(2);
const token = process.env.TELEGRAM_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!workerUrlArgument || !token || !secret) {
  console.error(
    "Usage: TELEGRAM_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... npm run telegram:set-webhook -- https://octo8bot.example.workers.dev",
  );
  process.exit(1);
}

if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error(
    "TELEGRAM_WEBHOOK_SECRET must be 1-256 characters using only letters, numbers, underscores, or hyphens.",
  );
  process.exit(1);
}

if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
  console.error("TELEGRAM_TOKEN is not a valid Telegram bot token.");
  process.exit(1);
}

let webhookUrl;
try {
  webhookUrl = new URL("/telegram", workerUrlArgument);
} catch {
  console.error("The Worker URL is invalid.");
  process.exit(1);
}

if (webhookUrl.protocol !== "https:") {
  console.error("The Worker URL must use HTTPS.");
  process.exit(1);
}

const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl.toString(),
      secret_token: secret,
      allowed_updates: ["message", "my_chat_member"],
    }),
  },
);

const result = await response.json();
if (!response.ok || result.ok !== true) {
  console.error("Telegram rejected the webhook configuration:", result);
  process.exit(1);
}

console.log(`Telegram webhook registered at ${webhookUrl.toString()}`);
