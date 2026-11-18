# Ring Toss

Fifteen bottles stand in three rows at the back of the stall. Drop a ring over a
bottle's neck to score. You have ten rings.

## How to play

- Move the mouse, or hold the arrow keys, to aim. Left and right aim across the
  stall, up and down aim further back or nearer.
- Click, or press Space, to throw. The ring is in the air for half a second, and
  you can throw again once it lands.
- A ring that lands within a neck's width of a bottle's centre drops over it.
  Anything else is a miss. A bottle that already has a ring scores nothing more.
- Throws stray a little, and the further away you aim, the more they stray.
- The round ends when all 10 rings have landed.
- Click, or press Space, on the game over screen to play another round.

## Scoring

| Row                  | Points per bottle |
| -------------------- | ----------------- |
| Front (nearest)      | 10                |
| Middle               | 20                |
| Back (furthest away) | 30                |

Each bottle scores once, so a round of ten rings on the back row and the middle
row can reach 5 x 30 + 5 x 20 = 250, if every throw were dead on.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `setAim`, `throwRing`,
  `resolveThrow`, `step`) and the `ringToss` entry the midway registers.
- `game.test.ts`: tests for the game logic.
