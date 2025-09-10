curl -X POST http://localhost:8000/webhook?chat_id=-1 \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "opened",
    "number": 1,
    "pull_request": {
      "number": 1,
      "title": "Add new feature",
      "user": { "login": "alice" },
      "html_url": "https://github.com/example/repo/pull/1"
    }
  }'

curl -X POST http://localhost:8000/webhook?chat_id=-1 \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "synchronize",
    "number": 1,
    "pull_request": {
      "number": 1,
      "title": "Add new feature",
      "user": { "login": "alice" },
      "html_url": "https://github.com/example/repo/pull/1"
    }
  }'

curl -X POST http://localhost:8000/webhook?chat_id=-1 \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "closed",
    "number": 1,
    "pull_request": {
      "number": 1,
      "title": "Add new feature",
      "user": { "login": "alice" },
      "html_url": "https://github.com/example/repo/pull/1",
      "merged": false
    }
  }'
