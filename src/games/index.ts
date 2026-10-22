import { createRegistry } from '../carnival';
import { coconutShy } from './coconut-shy/game';
import { waterCannon } from './water-cannon/game';

/** Every game on the midway. A new game is added to this list. */
export const registry = createRegistry([waterCannon, coconutShy]);
