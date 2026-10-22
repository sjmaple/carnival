# Candy Floss

The candy floss machine spins, and wisps of floss drift out of the drum. Catch
the pink ones on your paper cone and dodge the burnt ones.

## How to play

- Move the mouse, or hold the left and right arrow keys, to move the cone along
  the bottom of the booth.
- Catch a wisp by letting it drift into the mouth of the cone. Wisps that get past
  the cone are gone.
- A round lasts 30 seconds. Wisps leave the drum every 0.8 seconds at the start,
  speeding up to every 0.35 seconds by the end. About one wisp in five is burnt.
- The floss on the cone grows as your score goes up.
- Click on the game over screen to play another round.

## Scoring

| Wisp           | Grams |
| -------------- | ----- |
| Pink           | +10   |
| Burnt (darker) | -25   |

The score never drops below 0. Your score is the grams of floss on the cone
when time runs out, and it is saved to the carnival's score board when the round
ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `spawnWisp`, `moveCone`,
  `catchWisp`, `spawnInterval`, `timeLeft`, `flossRadius`) and the `candyFloss`
  entry the midway registers.
- `game.test.ts`: tests for the game logic.
