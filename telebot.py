import os
from telegram import Bot, Update
from telegram.ext import Application, ChatMemberHandler, ContextTypes

TOKEN = os.environ["TELEGRAM_TOKEN"]
WEBHOOK_URL = os.environ["WEBHOOK_URL"]

bot = Bot(token=TOKEN)


def format_webhook_url(chat_id: int):
    return f"{WEBHOOK_URL}?chat_id={chat_id}"


async def greet_on_join(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    result = update.my_chat_member
    if result is None:
        return
    chat_id = result.chat.id
    await context.bot.send_message(
        chat_id=chat_id,
        text=format_webhook_url(chat_id),
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
