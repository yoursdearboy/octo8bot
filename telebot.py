import os
from telegram import Update
from telegram.ext import Application, ChatMemberHandler, ContextTypes

if token := os.environ.get("TELEGRAM_TOKEN"):
    TOKEN = token
else:
    raise RuntimeError("Set TELEGRAM_TOKEN environment variable.")

async def greet_on_join(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    result = update.my_chat_member
    if result is None:
        return
    chat_id = result.chat.id
    await context.bot.send_message(
        chat_id=chat_id,
        text=f"http://rxdx.ru/octo8bot?chat_id={chat_id}",
    )

def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(ChatMemberHandler(greet_on_join, chat_member_types=ChatMemberHandler.MY_CHAT_MEMBER))
    app.run_polling()

if __name__ == "__main__":
    main()
