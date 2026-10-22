# Candy Floss

The candy floss machine spins, and wisps of floss drift out of the drum. Catch
them in your paper cone before they float out of reach.

## How to play

- Move the mouse, or hold the left and right arrow keys, to slide the cone.
- Catch the pink wisps. Dodge the burnt (darker brown) ones: about one wisp in five is burnt.
- A round lasts 30 seconds. Wisps come faster as the round goes on, from one
  every 0.9 seconds at the start to one every 0.35 seconds at the end.
- The floss on your cone grows as your score goes up.
- Click on the game over screen to play another round.

## Scoring

| Wisp  | Grams |
| ----- | ----- |
| Pink  | +10   |
| Burnt | -25   |

The cone never drops below 0 grams. Your score is the grams of floss on the cone
when time runs out, and it is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `spawnWisp`, `moveCone`,
  `nudgeCone`, `catchWisp`, `timeLeft`) and the `candyFloss` entry the midway registers.
- `game.test.ts`: tests for the game logic.
