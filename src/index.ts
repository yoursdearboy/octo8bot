import {
  AutoRouter,
  error,
  withContent,
  type IRequest,
} from "itty-router";

interface Env {
  TELEGRAM_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
}

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
  my_chat_member?: {
    chat?: { id?: number | string };
    new_chat_member?: { status?: string };
  };
}

type JsonObject = Record<string, unknown>;

interface WebhookRequest extends IRequest {
  chatId?: string;
  content?: JsonObject;
}

const TELEGRAM_MESSAGE_LIMIT = 4096;
const MESSAGE_BUILD_LIMIT = 3800;
const MAX_PUSH_COMMITS = 10;
const START_MESSAGE =
  "👋 Add me to a group chat to receive GitHub notifications from a repo in it.";

const router = AutoRouter<WebhookRequest, [Env]>({
  missing: (request) =>
    request.method === "POST"
      ? new Response("Not Found", { status: 404 })
      : new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        }),
});

router.post(
  "/telegram",
  authenticateTelegram,
  withJsonObject,
  handleTelegramWebhook,
);
router.post("/github", requireChatId, withJsonObject, handleGitHubWebhook);

export default { ...router };

function authenticateTelegram(request: WebhookRequest, env: Env) {
  const suppliedSecret = request.headers.get(
    "X-Telegram-Bot-Api-Secret-Token",
  );
  if (!suppliedSecret || suppliedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return error(401, { status: "error", error: "unauthorized" });
  }
}

async function withJsonObject(request: WebhookRequest, _env: Env) {
  await withContent(request);
  if (!isJsonObject(request.content)) {
    return error(400, { status: "error", error: "invalid JSON" });
  }
}

function requireChatId(request: WebhookRequest, _env: Env) {
  const chatIdValue = request.query.chat_id;
  const chatId = (
    Array.isArray(chatIdValue) ? chatIdValue[0] : chatIdValue
  )?.trim();
  if (!chatId) {
    return error(400, {
      status: "error",
      error: "chat_id is required",
    });
  }
  request.chatId = chatId;
}

async function handleTelegramWebhook(
  request: WebhookRequest,
  env: Env,
): Promise<JsonObject | Response> {
  const update = request.content as TelegramUpdate;
  const incomingMessage = update.message;
  if (
    incomingMessage?.chat?.id !== undefined &&
    isStartCommand(incomingMessage.text)
  ) {
    try {
      await sendTelegramMessage(
        env.TELEGRAM_TOKEN,
        String(incomingMessage.chat.id),
        START_MESSAGE,
      );
    } catch (error) {
      return upstreamError(error);
    }

    return { status: "ok" };
  }

  const membership = update.my_chat_member;
  const status = membership?.new_chat_member?.status;
  const chatId = membership?.chat?.id;
  if (
    chatId === undefined ||
    (status !== "member" && status !== "administrator")
  ) {
    return { status: "ok" };
  }

  const githubWebhookUrl = new URL("/github", request.url);
  githubWebhookUrl.searchParams.set("chat_id", String(chatId));

  const message = [
    "👋 Hello!",
    "",
    `Your GitHub webhook URL is: <code>${escapeHtml(githubWebhookUrl.toString())}</code>`,
    "",
    "In the repository, open <b>Settings ➔ Webhooks ➔ Add webhook</b>.",
    "Use the URL above as the <b>Payload URL</b>, select <code>application/json</code>, and enable <b>Pull requests</b> and <b>Pushes</b>.",
    "",
    "The bot will notify this chat about pull requests and regular branch pushes.",
  ].join("\n");

  try {
    await sendTelegramMessage(env.TELEGRAM_TOKEN, String(chatId), message);
  } catch (error) {
    return upstreamError(error);
  }

  return { status: "ok" };
}

function isStartCommand(text: unknown): boolean {
  return (
    typeof text === "string" &&
    /^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/.test(text)
  );
}

async function handleGitHubWebhook(
  request: WebhookRequest,
  env: Env,
): Promise<JsonObject | Response> {
  const event = request.headers.get("X-GitHub-Event");
  const message = formatGitHubMessage(event, request.content!);
  if (!message) {
    return { status: "ok" };
  }

  try {
    await sendTelegramMessage(env.TELEGRAM_TOKEN, request.chatId!, message);
  } catch (error) {
    return upstreamError(error);
  }

  return { status: "ok" };
}

function formatGitHubMessage(event: string | null, payload: JsonObject): string | null {
  if (event === "ping") {
    const repository = asObject(payload.repository);
    const name = shortText(repository.full_name, 160, "unknown repository");
    return `✅ Successfully installed in ${htmlLink(repository.html_url, name)}`;
  }

  if (event === "pull_request") {
    return formatPullRequest(payload);
  }

  if (event === "push") {
    return formatPush(payload);
  }

  return null;
}

function formatPullRequest(payload: JsonObject): string | null {
  const action = stringValue(payload.action);
  if (action !== "opened" && action !== "synchronize" && action !== "closed") {
    return null;
  }

  const pullRequest = asObject(payload.pull_request);
  const number = shortText(pullRequest.number, 20, "?");
  const title = shortText(pullRequest.title, 300, "Untitled");
  const user = asObject(pullRequest.user);
  const author = shortText(user.login, 80, "unknown");
  const label = `#${number} ${title}`;
  const linkedPullRequest = htmlLink(pullRequest.html_url, label);

  if (action === "opened") {
    return `🎉 PR created: ${linkedPullRequest} by ${escapeHtml(author)}`;
  }
  if (action === "synchronize") {
    return `🧩 PR updated: ${linkedPullRequest}`;
  }
  return `🏁 PR closed: ${linkedPullRequest}`;
}

function formatPush(payload: JsonObject): string | null {
  const ref = stringValue(payload.ref);
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  if (
    !ref?.startsWith("refs/heads/") ||
    payload.created === true ||
    payload.deleted === true ||
    commits.length === 0
  ) {
    return null;
  }

  const repository = asObject(payload.repository);
  const pusher = asObject(payload.pusher);
  const repositoryName = shortText(
    repository.full_name,
    160,
    "unknown repository",
  );
  const branch = shortText(ref.slice("refs/heads/".length), 180, "unknown");
  const pushedBy = shortText(pusher.name, 80, "unknown");
  const declaredSize = numberValue(payload.size);
  const commitCount = Math.max(declaredSize ?? 0, commits.length);
  const commitWord = commitCount === 1 ? "commit" : "commits";
  const repositoryLink = htmlLink(repository.html_url, repositoryName);
  const compareLink = htmlLink(payload.compare, `${commitCount} ${commitWord}`);
  const lines = [
    `🚀 Push to ${repositoryLink} on <code>${escapeHtml(branch)}</code> by ${escapeHtml(pushedBy)}: ${compareLink}`,
  ];

  let included = 0;
  const candidates = commits.slice(0, MAX_PUSH_COMMITS);
  for (const candidate of candidates) {
    const commit = asObject(candidate);
    const sha = shortText(commit.id, 7, "unknown");
    const firstLine = shortText(
      stringValue(commit.message)?.split(/\r?\n/, 1)[0],
      180,
      "No commit message",
    );
    const line = `• ${htmlLink(commit.url, sha)} ${escapeHtml(firstLine)}`;
    const omitted = Math.max(commitCount - included - 1, 0);
    const reserve = omitted > 0 ? `\n…and ${omitted} more` : "";
    if (`${lines.join("\n")}\n${line}${reserve}`.length > MESSAGE_BUILD_LIMIT) {
      break;
    }
    lines.push(line);
    included += 1;
  }

  const omitted = Math.max(commitCount - included, 0);
  if (omitted > 0) {
    lines.push(`…and ${omitted} more`);
  }

  const message = lines.join("\n");
  return message.length <= TELEGRAM_MESSAGE_LIMIT
    ? message
    : lines[0].slice(0, MESSAGE_BUILD_LIMIT);
}

async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Telegram API returned ${response.status}: ${detail}`);
  }
}

function asObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function shortText(
  value: unknown,
  maximumLength: number,
  fallback: string,
): string {
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  if (!text) {
    return fallback;
  }
  return text.length > maximumLength
    ? `${text.slice(0, maximumLength - 1)}…`
    : text;
}

function htmlLink(rawUrl: unknown, label: string): string {
  const safeUrl = httpUrl(rawUrl);
  const safeLabel = escapeHtml(label);
  if (!safeUrl) {
    return safeLabel;
  }
  const link = `<a href="${escapeHtml(safeUrl)}">${safeLabel}</a>`;
  return link.length <= 1200 ? link : safeLabel;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function upstreamError(cause: unknown): Response {
  console.error(cause);
  return error(
    502,
    { status: "error", error: "Telegram API request failed" },
  );
}
