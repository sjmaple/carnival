---
name: review-in-review
description: When a Linear issue delegated to Tessl moves to In Review, run Tessl Code Review on its pull request and publish the findings to the pull request. Use when the review-in-review loop runs on a Linear issue update. Never changes code, merges, or moves the issue.
---

# Review an issue in In Review

A Linear issue delegated to Tessl moved to **In Review**. Review its pull
request with Tessl Code Review, publish the review on the pull request, and
tell the issue where to find it.

## Your inputs

- `.cloud-launch/trigger-events.json`: a JSON array of `{event, payload}`
  Linear webhooks, oldest first. The issue identifier is
  `payload.data.identifier`, for example `CAR-12`. If the file is missing,
  malformed, or names more than one issue, stop and say what was wrong.

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
response with `errors` is a failed call. The only write you make is
`commentCreate(input: {issueId, body})`.

## Steps

1. Query `issue(id: "<identifier>")` for `id identifier state { name }`. If the
   state is no longer `In Review`, stop silently: a person moved it on.
2. Find the open pull request. The implement loop opens it from the branch
   `tessl/<identifier lowercased>`:
   `gh pr list --state open --head tessl/<id> --json url,number,title`.
   If there is none, search the titles:
   `gh pr list --state open --search "<identifier> in:title" --json url,number,title`.
   If there is still none, or more than one, comment on the issue saying so,
   end the comment with `<!-- tessl-factory:review -->`, and stop.
3. Run the review and publish it to the pull request:

   ```bash
   tessl code review run --pr <pr url> --publish comment --json --org tessl
   ```

   Read `status` before `outcome.findings`. If the review failed, comment on
   the issue with the failure in one sentence and stop.

4. Comment on the issue: `Code review posted on <pr url>: <n> findings` and, when
   there are findings, one line per finding with its severity and title. End
   with `<!-- tessl-factory:review -->`.

## Invariants

- You never change code, push, merge, approve, or move the issue's state.
- You post one comment per round on the issue, and one review on the pull
  request.
