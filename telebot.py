import os
from telegram import Bot, Update
from telegram.ext import Application, ChatMemberHandler, ContextTypes

TOKEN = os.environ["TELEGRAM_TOKEN"]
WEBHOOK_URL = os.environ["WEBHOOK_URL"]

bot = Bot(token=TOKEN)


def format_webhook_url(chat_id: int):
    return f"{WEBHOOK_URL}?chat_id={chat_id}"


def setup_message(chat_id: int):
    return (
        "Hello!\n\n"
        "Your webhook URL is: " f"{format_webhook_url(chat_id)}" "\n\n"
        "Go to the GitHub repository page, click <b>Settings ➔ Webhooks ➔ Add webhook</b>. "
        "Copy the URL into the <b>Payload URL</b> field, and in the <b>Content type</b> field select <code>application/json</code>. "
        "Then choose the <b>Send me everything</b> option below.\n\n"
        "For now, the bot only supports Pull Request events.\n"
        "<a href='https://github.com/yoursdearboy/octo8bot'>PRs are welcome</a>."
    )


async def greet_on_join(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    result = update.my_chat_member
    if result is None:
        return
    if result.new_chat_member.status != "member":
        return
    chat_id = result.chat.id
    await context.bot.send_message(
        chat_id=chat_id, text=setup_message(chat_id), parse_mode="HTML"
    )


def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(
        ChatMemberHandler(
            greet_on_join,
            chat_member_types=ChatMemberHandler.MY_CHAT_MEMBER,
        )
    )
    app.run_polling()


if __name__ == "__main__":
    main()
