---
name: move-to-in-review
description: When Tessl opens a pull request for a Linear issue, move that issue to the team's In Review state so code review starts. Use when the move-to-in-review loop runs on a pull request opened on a tessl/ branch. Changes only the Linear issue's state.
---

# Move to In Review

Tessl's implement loop opened a pull request for a Linear issue. Move the issue
to **In Review**, which starts the code review loop. Do nothing else.

## Your inputs

- `.cloud-launch/trigger-events.json`: a JSON array of `{event, payload}`
  GitHub webhooks. Use the last `pull_request` payload. The pull request's
  title starts with the Linear issue identifier, for example `CAR-12: ...`,
  and its body has a `Closes CAR-12` line.

## Linear

Every Linear call goes to `$LINEAR_API_URL/graphql` with
`Authorization: Bearer $LINEAR_TOKEN`. Never call `api.linear.app` directly.

```bash
linear() {  # usage: linear <file with {"query": ..., "variables": ...}>
  curl -sS --fail-with-body -X POST "$LINEAR_API_URL/graphql" \
    -H "Authorization: Bearer $LINEAR_TOKEN" -H "Content-Type: application/json" \
    --data @"$1"
}
```

Write each request body to a file, never through shell interpolation. A
response with `errors` is a failed call.

## Steps

1. Read the identifier from the start of the pull request title. If the title
   has none, use the `Closes <identifier>` line in the body. If neither has
   one, stop and say so.
2. Query `issue(id: "<identifier>")` for `id identifier state { name type }
delegate { id } team { states { nodes { id name } } }`.
3. Stop without writing if any of these hold:
   - the issue is not delegated to anyone (a person took it back);
   - its state type is `backlog`, `triage`, `completed` or `canceled`;
   - it is already in **In Review**.
4. Find the team state named exactly `In Review`. If there is none, stop and
   say so.
5. Call `issueUpdate(id: <issue id>, input: {stateId: <In Review id>})`.

## Invariants

- You write one thing: the issue's state. No comments, no code, no pull
  request changes.
- You never move an issue that a person has taken back or ended.
