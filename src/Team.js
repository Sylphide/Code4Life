import Entity from './Entity';
import { getClosest, getCell, getDistance2, getSighed, getDistance, getClosestFrom } from './Utils';
import { mapData, quickAccess } from './MapData';

export default class Team {

  constructor(id) {
    if (id === 0) {
      this.x = 0;
      this.y = 0;
      this.ennemyX = 16000;
      this.ennemyY = 9000;
    } else {
      this.x = 16000;
      this.y = 9000;
      this.ennemyX = 0;
      this.ennemyY = 0;
    }
    this.busters = [];
  }

  createOrUpdateBuster(id, x, y, type, state, value) {
    let found = false;
    this.busters.forEach((buster) => {
      if (buster.id === id) {
        buster.x = x;
        buster.y = y;
        buster.value = value;
        buster.state = state;
        buster.helping = false;
        if (!buster.isStunAvailable()) {
          buster.stunCD--;
        }
        if (!buster.destination || (buster.x === buster.destination.x && buster.y === buster.destination.y)) {
          buster.currentAction = 'IDLE';
        }
        found = true;
      }
    });

    if (!found) {
      const buster = new Entity(id, x, y, type, state, value);
      this.busters.push(buster);
    }
  }

  updateHasGhost() {
    this.busters.forEach((buster) => {
      const busterCell = getCell(buster.x, buster.y);
      busterCell.updateHasGhost();
    });
  }

  getNbTeamTrapping(id) {
    let count = 0;
    this.busters.forEach((buster) => {
      if (buster.state === 3 && buster.value === id) {
        count++;
      }
    });
    return count;
  }

  makeDecision() {
    this.busters.forEach((buster) => {
      if (buster.state === 3) {
        this.trappingDecision(buster);
      }
      if (buster.state === 1) {
        this.carryingDecision(buster);
      }
      if (buster.state === 0 && !buster.helping) {
        // Moving
        if (this.shouldDefendLast(buster)) {
          return;
        }

        // let { closest: closestEnnemy, minDist: ennemyDistance }
        //   = getClosestFrom(buster, mapData.sighedBusters, [this.ennemyX, this.ennemyY]);
        // if (!closestEnnemy) {
        const { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(buster, mapData.sighedBusters);
        // }
        if (closestEnnemy
          // && (closestEnnemy.state === 1 || closestEnnemy.state === 3)
          && closestEnnemy.state !== 2) {
          if (ennemyDistance < 1760
            && buster.isStunAvailable()) {
            buster.stun(closestEnnemy.id);
            closestEnnemy.state = 2;
            const ghost = mapData.getGhost(closestEnnemy.value);
            if (ghost) {
              ghost.giveUp = false;
            }
            return;
          } else if (ennemyDistance < 2200) {
            const ennemyToBase = getDistance2([closestEnnemy.x, closestEnnemy.y], [this.ennemyX, this.ennemyY]);
            let distanceToBase = getDistance2([buster.x, buster.y], [this.ennemyX, this.ennemyY]);
            if (closestEnnemy.state === 1 && distanceToBase > ennemyToBase) {
              distanceToBase = this.goToBase(buster, true);
              if (Math.ceil(distanceToBase / 800) > buster.stunCD) {
                return;
              }
            } else {
              buster.goTo(closestEnnemy.x, closestEnnemy.y);
              return;
            }
          }
        }

        printErr(mapData.ghosts.map((ghost) => ghost.toString()));
        const inSigh = getSighed(buster, mapData.ghosts);
        let closest;
        let minDist;
        inSigh.forEach(({ currentEntity, currentDist }) => {
          if (!currentEntity.giveUp && (!closest || currentEntity.state < closest.state || currentDist < minDist)) {
            closest = currentEntity;
            minDist = currentDist;
          }
        });
        if (!closest) {
          ({ closest, minDist } = getClosest(buster, mapData.ghosts));
        }
        if (closest && !closest.giveUp) {
          if (minDist < 1760 && minDist >= 900) {
            buster.bust(closest.id);
          } else if (minDist < 900) {
            this.goToBase(buster);
          } else {
            const nbTurnToGo = Math.ceil((minDist - 1760) / 800);
            if (closest.state - closest.value * nbTurnToGo > 0
              && (closest.value !== 0 || minDist < 2200)
              // || closest.value === 1
            ) {
              buster.goTo(closest.x, closest.y);
            } else {
              this.search(buster);
            }
          }
        } else {
          this.search(buster);
        }
      }
      if (buster.state === 2) {
        this.search(buster);
      }
    });
  }

  carryingDecision(buster) {
    // Carrying
    mapData.release(buster.value);
    if (buster.isInBaseRange()) {
      buster.release();
      return;
    }
    const { closest: closestEnnemy, minDist: ennemyDistance }
      = getClosest(buster, mapData.sighedBusters);
    if (closestEnnemy && closestEnnemy.state !== 1 && closestEnnemy.state !== 2 && ennemyDistance < 2200) {
      this.avoid(buster, closestEnnemy);
      return;
    }
    this.goToBase(buster);
    return;
  }

  shouldDefendLast(buster) {
    if (mapData.score === ((mapData.nbGhosts - 1) / 2)) {
      let carryingBuster = null;
      let minDist = 100000;
      this.busters.forEach((currentBuster) => {
        const distance = getDistance(buster, currentBuster);
        if (currentBuster.state === 1 && distance < minDist) {
          carryingBuster = currentBuster;
          minDist = distance;
        }
      });
      if (carryingBuster) {
        printErr(buster.id, 'Defend', carryingBuster.id);
        const { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(buster, mapData.sighedBusters);
        if (closestEnnemy
          && ennemyDistance < 1760 && buster.isStunAvailable()) {
          buster.stun(closestEnnemy.id);
        } else {
          buster.goTo(carryingBuster.x, carryingBuster.y);
        }
        return true;
      }
    }
    return false;
  }

  trappingDecision(buster) {
    // Trapping
    // let { closest: closestEnnemy, minDist: ennemyDistance }
      // = getClosestFrom(buster, mapData.sighedBusters, [this.ennemyX, this.ennemyY]);
    // if (!closestEnnemy) {
    const { closest: closestEnnemy, minDist: ennemyDistance }
      = getClosest(buster, mapData.sighedBusters);
    // }
    const ghost = mapData.getGhost(buster.value);
    let teamTrapping = -1;
    let ennemyTrapping = -1;
    if (ghost) {
      teamTrapping = this.getNbTeamTrapping(ghost.id);
      ennemyTrapping = ghost.value - teamTrapping;
    }
    if (closestEnnemy
      // && (closestEnnemy.state === 1 || closestEnnemy.state === 3)
      && closestEnnemy.state !== 2
      && (teamTrapping === -1 || (ennemyTrapping < teamTrapping
        || (teamTrapping === ennemyTrapping && closestEnnemy.value === ghost.id)))
      && buster.isStunAvailable()) {
      if (ennemyDistance < 1760) {
        buster.stun(closestEnnemy.id);
        closestEnnemy.state = 2;
        return;
      } else if (ennemyDistance < 2200) {
        buster.goTo(closestEnnemy.x, closestEnnemy.y);
        return;
      }
    }
    if (!ghost) {
      buster.state = 0;
      return;
    }
    if (ennemyTrapping >= teamTrapping) {
      const needed = ennemyTrapping - teamTrapping;
      if (!this.askForHelp(buster, needed)) {
        ghost.giveUp = true;
        buster.state = 0;
      }
    } else {
      ghost.state--;
      if (ghost.state === 0) {
        mapData.release(ghost.id);
      }
    }
  }

  avoid(buster, ennemy) {
    printErr(buster.id, 'avoid');
    const ennemyRange = Math.pow(2560, 2);
    const a = 2 * (ennemy.x - buster.x);
    const b = 2 * (ennemy.y - buster.y);
    const c = Math.pow((ennemy.x - buster.x), 2) +
      Math.pow((ennemy.y - buster.y), 2) - ennemyRange + 640000; // 1800 - 800
    const delta = Math.pow(2 * a * c, 2) -
      4 * (Math.pow(a, 2) + Math.pow(b, 2)) * (Math.pow(c, 2) - Math.pow(b, 2) * 640000);
    if (delta <= 0) {
      buster.goTo(this.x, this.y);
      return;
    }
    const x1 = buster.x + Math.floor((2 * a * c - Math.sqrt(delta)) / (2 * (Math.pow(a, 2) + Math.pow(b, 2))));
    const x2 = buster.x + Math.floor((2 * a * c + Math.sqrt(delta)) / (2 * (Math.pow(a, 2) + Math.pow(b, 2))));
    let y1;
    let y2;
    if (b !== 0) {
      y1 = buster.y + Math.floor((c - a * (x1 - buster.x)) / b);
      y2 = buster.y + Math.floor((c - a * (x2 - buster.x)) / b);
    } else {
      y1 = buster.y + Math.floor(Math.sqrt(ennemyRange - Math.pow(((2 * c - Math.pow(a, 2)) / (2 * a)), 2)));
      y2 = buster.y - Math.floor(Math.sqrt(ennemyRange - Math.pow(((2 * c - Math.pow(a, 2)) / (2 * a)), 2)));
    }
    printErr(ennemy.id, buster.id, a, b, c, delta, x1, x2, y1, y2);
    const distance1 = getDistance2([this.x, this.y], [x1, y1]);
    const distance2 = getDistance2([this.x, this.y], [x2, y2]);
    if (distance1 < distance2) {
      buster.goTo(x1, y1);
    } else {
      buster.goTo(x2, y2);
    }
  }

  askForHelp(buster, needed) {
    let available = 0;
    const helpers = [];
    const ghost = mapData.getGhost(buster.value);
    this.busters.forEach((currentBuster) => {
      if (available >= needed + 1) {
        return;
      }
      if (currentBuster.state !== 1 && (currentBuster.state !== 2 || currentBuster.value === 1)
        && (!currentBuster.helping || currentBuster.helpingOn === ghost.id)
        && currentBuster.id !== buster.id) {
        // currentBuster.bust(buster.value);
        const distance = getDistance2([currentBuster.x, currentBuster.y], [ghost.x, ghost.y]);
        const nbTurnToGo = Math.ceil((distance - 1760) / 800);
        if (ghost.state - ghost.value * nbTurnToGo > 0
        || (ghost.state === 0 && needed === 0)) {
          helpers.push(currentBuster);
          available++;
        }
      }
    });
    printErr(buster.id, 'AskingForHelp', available, needed, 'Busters', helpers.map((currentBuster) => currentBuster.id));
    if (available >= needed) {
      helpers.forEach((currentBuster) => {
        const distance = getDistance2([currentBuster.x, currentBuster.y], [ghost.x, ghost.y]);
        currentBuster.helping = true;
        currentBuster.helpingOn = ghost.id;
        if (distance < 1760 && distance >= 900) {
          currentBuster.bust(ghost.id);
        } else if (distance < 900) {
          this.goToBase(currentBuster);
        } else {
          currentBuster.goTo(ghost.x, ghost.y);
        }
      });
      return true;
    }
    return false;
  }

  search(buster) {
    if (buster.currentAction === 'IDLE') {
      printErr(buster.id, 'search');
      // RANDOM
      // let cellNumber = Math.floor(Math.random() * 48);
      // let cell = mapData.grid[cellNumber];
      // while (cell.noGhost
      //   && cellNumber !== quickAccess.ennemyBase
      //   && cellNumber === quickAccess.myBase) {
      //   cellNumber = (cellNumber + 1) % 48;
      //   cell = mapData.grid[cellNumber];
      // }
      // buster.goTo(cell.x, cell.y);

      let minDist = 1000000;
      let closestCell = null;
      mapData.grid.forEach((cell) => {
        const distance = getDistance2([buster.x, buster.y], [cell.x, cell.y]);
        if (distance < minDist && !cell.noGhost && !cell.searched) {
          closestCell = cell;
          minDist = distance;
        }
      });
      if (closestCell) {
        closestCell.searched = true;
        buster.goTo(closestCell.x, closestCell.y);
      } else {
        this.goToBase(buster, true);
      }
    }
  }

  goToBase(buster, ennemy = false) {
    printErr(buster.id, 'goToBase');
    const baseX = ennemy ? this.ennemyX : this.x;
    const baseY = ennemy ? this.ennemyY : this.y;
    if ((buster.x - baseX) !== 0) {
      const a = (buster.y - baseY) / (buster.x - baseX);
      const b = buster.y - a * buster.x;
      const A = 1 + Math.pow(a, 2);
      const B = 2 * (a * (b - baseY) - baseX);
      const C = Math.pow(baseX, 2) +
        Math.pow((b - baseY), 2) - Math.pow(1500, 2);
      const delta = Math.pow(B, 2) - 4 * A * C;
      const x1 = Math.round((- B - Math.sqrt(delta)) / (2 * A));
      const x2 = Math.round((- B + Math.sqrt(delta)) / (2 * A));
      const y1 = Math.round(a * x1 + b);
      const y2 = Math.round(a * x2 + b);
      const distance1 = getDistance2([buster.x, buster.y], [x1, y1]);
      const distance2 = getDistance2([buster.x, buster.y], [x2, y2]);
      if (distance1 < distance2) {
        buster.goTo(x1, y1);
        return distance1;
      }
      buster.goTo(x2, y2);
      return distance2;
    }
    buster.goTo(buster.x, Math.abs(baseY - 1600));
    return getDistance2([buster.x, buster.y], [buster.x, Math.abs(baseY - 1600)]);
  }

  toString() {
    return this.busters.map((buster) => buster.toString());
  }
}
