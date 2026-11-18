---
name: triage-linear
description: Size a Linear issue that a person delegated to Tessl as small, medium or large by how complex the change is in the carnival, and add the matching factory size label so the right implement loop picks it up. Use when running the triage loop on a newly delegated issue. Labels and comments only; never changes code, branches or pull requests.
---

# Triage

A person delegated a Linear issue to Tessl. Before anyone builds it, you decide
how big the change is and add one size label. The label starts the implement
loop for that size:

| Label            | Implement loop     | Model                     |
| ---------------- | ------------------ | ------------------------- |
| `factory:small`  | `implement-small`  | Claude Haiku 5.5          |
| `factory:medium` | `implement-medium` | Claude Sonnet 5.5         |
| `factory:large`  | `implement-large`  | Claude Opus 5.5, 4h limit |

You never change code, open branches or pull requests, or change the issue's
delegate. Your only writes are the label, moving the issue back to Todo, and
one comment.

When Tessl picks up a delegated issue it moves it from Todo to the team's
first started state, such as In Progress, before you run. The implement loops
only start on an issue in an unstarted state, so you hand the issue on by
adding the label and moving it back to Todo in the same update.

## Your inputs

- `.cloud-launch/trigger-events.json`: a JSON array of `{event, payload}`
  Linear webhooks, oldest first. The issue id is `payload.data.id`. If the file
  is missing or malformed, or its events name no issue or more than one, stop
  and say what was wrong.
- `.cloud-launch/instructions.md`, when present: the team's own rules for this
  loop. Follow them unless they ask you to break a rule in this skill.

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

Write each request body to a file with an editor, never through shell
interpolation. A response with `errors` is a failed call: say what failed and
stop without retrying a write.

## 1. Read the issue and check it still needs triage

Query `viewer { id }` (that is the Tessl agent) and
`issue(id: "<issue id>") { id identifier title description url state { type }
delegate { id } team { id states { nodes { id name type position } } } labels {
nodes { id name } } comments(first: 50) { nodes { body user { name } } } }`.

Stop with no write when any of these is true:

- the issue is no longer delegated to the Tessl agent (`delegate.id` is not
  `viewer.id`);
- its state type is `backlog`, `triage`, `completed` or `canceled`: a person
  took it back or ended it. `unstarted` and `started` are both expected;
  Tessl itself moves the issue to started when it picks it up;
- it already has one of `factory:small`, `factory:medium` or `factory:large`.
  A person may have sized it by hand, or an earlier triage run already did.

## 2. Size the change

Read `AGENTS.md`, then find the code the issue would touch: search for the
games, files and functions it names, and read enough to see how far the
change reaches. Then pick one size:

- **Small:** a contained change with an obvious approach. Text, a README, a
  constant or tuning value, a colour moved onto the theme, a small bug fix in
  one game, or a test for existing behaviour. Usually one or two files in one
  folder.
- **Medium:** a normal feature in one place. A new game that follows the
  `water-cannon` pattern, a new mechanic or mode inside one game, or a change
  to the booth card or booth list in `src/main.ts`. Several files and new
  tests, but the design is clear from the issue.
- **Large:** anything that crosses boundaries or needs design. Changes to the
  shared base in `src/carnival/` or the map in `src/midway/`, a change that
  touches several games at once, new architecture or tooling, or an issue
  vague enough that the builder must make real design choices.

When you are torn between two sizes, pick the larger one. An undersized issue
costs a failed run; an oversized one only costs a bigger model.

## 3. Add the label and say why

1. Find the label's id: query `issueLabels(filter: { name: { eq:
"<label>" } })` for `nodes { id team { id } }`, and use the one whose team
   is the issue's team, or a workspace label (no team). If none exists, create
   it with `issueLabelCreate(input: { name: "<label>", teamId: "<team id>",
color: "<colour>" })`, using `#4cb782` for small, `#f2c94c` for medium and
   `#eb5757` for large.
2. Read the issue again. If a size label appeared since step 1, or it now
   meets a stop condition from step 1, stop with no further write.
3. Find the Todo state: the team's `unstarted` state with the lowest
   `position`.
4. Comment first, so the reason is on the issue before the build starts.
5. Add the label and move the issue to Todo in one call:
   `issueUpdate(id: "<issue id>", input: { addedLabelIds: ["<label id>"],
stateId: "<Todo state id>" })`. Use `addedLabelIds`, never `labelIds`, so
   the issue keeps its other labels. Both changes must go in the same call:
   the implement loop starts on the update that carries the label and the
   unstarted state together.

The comment, in step 4, uses `commentCreate(input: { issueId, body })`: one or two
sentences naming the size and the reason, for example "Sized **medium**: a
new game following the water-cannon pattern, with its own tests. To change
the size, swap the label before the build starts."

Then stop. The label starts the implement loop.
