import Entity from './Entity';
import Cell from './Cell';
import { getSighed, getDistance2 } from './Utils';

class MapData {

  constructor() {
    this.ghosts = [];
    this.grid = [];
    this.stealers = [];
    this.nbBusterDesperate = 0;
    this.turn = 0;
    this.score = 0;
    for (let i = 0; i < 48; i++) {
      const x = 1000 + 2000 * (i % 8);
      const y = 750 + 1500 * Math.floor(i / 8);
      this.grid.push(new Cell(x, y));
    }
  }

  setGhostsCount(ghostsCount) {
    this.nbGhosts = ghostsCount;
  }

  setMyTeamId(id) {
    this.myTeamId = id;
    if (id === 0) {
      this.y = 0;
      this.x = 0;
      this.ennemyX = 16000;
      this.ennemyY = 9000;
    } else {
      this.x = 16000;
      this.y = 9000;
      this.ennemyX = 0;
      this.ennemyY = 0;
    }
    this.grid[0].noGhost = true;
    this.grid[1].noGhost = true;
    this.grid[8].noGhost = true;
    this.grid[9].noGhost = true;
    this.grid[47].noGhost = true;
    this.grid[40].noGhost = true;
    this.grid[46].noGhost = true;
    this.grid[39].noGhost = true;
  }

  clearInstantData() {
    this.sighedGhosts = [];
    this.sighedBusters = [];
    this.ghosts.forEach((ghost) => {
      ghost.lastSeen++;
    });
    this.grid.forEach((cell) => {
      cell.searched = false;
    });
  }

  createOrUpdateGhost(id, x, y, state, value) {
    let found = false;
    this.ghosts.forEach((ghost) => {
      if (ghost.id === id) {
        ghost.x = x;
        ghost.y = y;
        ghost.value = value;
        ghost.state = state;
        ghost.lastSeen = 0;
        ghost.notYet = false;
        found = true;
      }
    });

    if (!found) {
      this.ghosts.push(new Entity(id, x, y, -1, state, value));
    }
  }

  addSighedGhost(id, x, y, state, value) {
    this.sighedGhosts.push(new Entity(id, x, y, -1, state, value));
    this.createOrUpdateGhost(id, x, y, state, value);
  }

  addSighedBuster(id, x, y, state, value) {
    this.sighedBusters.push(new Entity(id, x, y, this.myTeamId ? 0 : 1, state, value));
  }

  addSighedEntity(id, x, y, type, state, value) {
    if (type === -1) {
      this.addSighedGhost(id, x, y, state, value);
    } else {
      this.addSighedBuster(id, x, y, state, value);
    }
  }

  cleanFalseGhost(busters) {
    if (this.turn < 50) { // ATTENTION IMPACT best known 50
      const center = {
        x: 8000,
        y: 4500
      };
      this.sighedGhosts.forEach((sighedGhost) => {
        const specialId = -(sighedGhost.id + 1);
        const distanceToBase = getDistance2([sighedGhost.x, sighedGhost.y], [this.x, this.y]);
        if (!this.getGhost(specialId) && distanceToBase > 6000) { // ATTENTION IMPACT best known 5000
          const oppositeGhost = {
            x: 2 * center.x - sighedGhost.x,
            y: 2 * center.y - sighedGhost.y
          };
          this.ghosts.push(new Entity(specialId, oppositeGhost.x, oppositeGhost.y, -1, sighedGhost.state, 0));
        }
      });
    }

    busters.forEach((buster) => {
      const inSigh = getSighed(buster, this.ghosts);
      inSigh.forEach(({ currentEntity }) => {
        let isRealGhost = false;
        this.sighedGhosts.forEach((sighedGhost) => {
          if (currentEntity.id === sighedGhost.id) {
            isRealGhost = true;
          }
        });
        if (!isRealGhost) {
          this.release(currentEntity.id);
        }
      });
    });
  }

  release(id) {
    for (let i = 0; i < this.ghosts.length; i++) {
      if (this.ghosts[i].id === id) {
        printErr('release', id);
        this.ghosts.splice(i, 1);
        return;
      }
    }
  }

  getGhost(id) {
    for (let i = 0; i < this.ghosts.length; i++) {
      if (this.ghosts[i].id === id) {
        return this.ghosts[i];
      }
    }
    return null;
  }

  printErr() {
    printErr('mapData', this.nbGhosts, this.myTeamId);
    printErr(this.ghosts.map((ghost) => ghost.toString()));
    printErr(this.sighedGhosts.map((ghost) => ghost.toString()));
    printErr(this.sighedBusters.map((buster) => buster.toString()));
    printErr(this.grid.map((cell, index) => {
      if (cell.noGhost) {
        return `cell ${index}`;
      }
      return '';
    }));
  }
}

export const mapData = new MapData();
