import { mapData } from './MapData';
import { getDistance2, cleanCoords } from './Utils';

export default class Entity {

  constructor(id, x, y, type, state, value) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.type = type;
    this.state = state;
    this.value = value;
    this.startingLoop = true;
    this.helping = false;
    this.currentAction = 'IDLE';
    this.stunCD = 0;
  }

  goTo(x, y) {
    const { x: cleanX, y: cleanY } = cleanCoords(x, y);
    this.action = `MOVE ${cleanX} ${cleanY}`;
    this.destination = { x: cleanX, y: cleanY };
    this.currentAction = 'MOVING';
  }

  bust(id) {
    this.action = `BUST ${id}`;
    this.destination = null;
  }

  release() {
    this.action = 'RELEASE';
    this.destination = null;
    mapData.release(this.value);
    mapData.score++;
  }

  stun(id) {
    this.action = `STUN ${id}`;
    this.destination = null;
    this.stunCD = 21;
    printErr('Setting stun CD', this.id);
  }

  isInBaseRange() {
    if (this.type === 0) {
      return getDistance2([this.x, this.y], [0, 0]) <= 1600;
    }
    return getDistance2([this.x, this.y], [16000, 9000]) <= 1600;
  }

  isStunAvailable() {
    return this.stunCD === 0 || this.stunCD === 21;
  }

  toString() {
    let readableType = 'ghost';
    if (this.type === mapData.myTeamId) {
      readableType = 'buster';
    } else if (this.type !== -1) {
      readableType = 'ennemy';
    } else if (this.giveUp) {
      readableType += ' givenUp';
    }
    return `${this.id} [${this.x}, ${this.y}] ${readableType} ${this.state} ${this.value} ${this.stunCD}`;
  }
}
