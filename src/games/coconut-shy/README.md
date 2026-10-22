# Coconut Shy

Five coconuts sit on posts along the back of the stall. Knock them off with six
wooden balls.

## How to play

- Move the mouse, or hold the left and right arrow keys, to aim along the posts.
- Hold the mouse button, or Space, to charge the throw's power. The meter at the
  bottom fills in a second and a half. Let go to throw.
- The ball flies in an arc. Too little power and it falls short; too much and it
  sails over the top. Somewhere around the middle of the meter is right.
- A strong, central hit knocks a coconut off its post. A glancing hit, near the
  coconut's edge, only wobbles it. A ball between two coconuts misses.
- You have 6 balls, and throw one at a time. The round ends when the balls run
  out or every coconut is down.
- Click, or press Space, on the game over screen to play another round.

## Scoring

| What                                | Points |
| ----------------------------------- | ------ |
| Knocking a coconut off              | 100    |
| A wobble that doesn't knock it off  | 10     |
| Clearing all five coconuts          | 200    |
| Each ball left after clearing all 5 | 50     |

A perfect round knocks off a coconut with each of the first five balls:
500 + 200 + 50 = 750.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `setAim`, `startCharge`, `throwBall`,
  `resolveThrow`, `step`) and the `coconutShy` entry the midway registers.
- `game.test.ts`: tests for the game logic.
