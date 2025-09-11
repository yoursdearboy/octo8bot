from fastapi import FastAPI, Header, Request
from telebot import bot

app = FastAPI()

@app.post("/")
async def github_webhook(
    request: Request,
    chat_id: str,
    x_github_event: str = Header(None),
):
    data = await request.json()

    if x_github_event == "pull_request":
        action = data.get("action")
        pr = data.get("pull_request", {})
        pr_number = pr.get("number")
        title = pr.get("title")
        user = pr.get("user", {}).get("login")
        url = pr.get("html_url")

        if action == "opened":
            message = f"PR created: <a href='{url}'>#{pr_number} {title}</a> by {user}"
        elif action == "synchronize":
            message = f"PR updated: <a href='{url}'>#{pr_number} {title}</a>"
        elif action == "closed":
            message = f"PR closed: <a href='{url}'>#{pr_number} {title}</a>"

        await bot.send_message(chat_id=chat_id, text=message, parse_mode="HTML")

    return {"status": "ok"}
