import Entity from './Entity';
import { getClosest, getCell, getDistance2, getDistance, roundForBase, getNextPos, getSighed } from './Utils';
import { mapData } from './MapData';

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
        if (buster.stunCD > 0) {
          buster.stunCD--;
        }
        if (!buster.destination) {
          buster.currentAction = 'IDLE';
        } else {
          const destinationCell = getCell(buster.destination.x, buster.destination.y);
          const busterCell = getCell(buster.x, buster.y);
          if (busterCell.x === destinationCell.x && busterCell.y === destinationCell.y) {
            buster.currentAction = 'IDLE';
          }
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
      const distanceToBase = getDistance2([buster.x, buster.y], [this.x, this.y]);
      if (buster.helping) {
        printErr(buster.id, 'Helping', buster.helpingOn);
      }
      if (distanceToBase < 4000) {
        this.updateStealers(buster);
      }
      if (buster.state === 1) {
        this.carryingDecision(buster);
      }
      if (buster.state === 3 && !buster.helping) {
        this.trappingDecision(buster);
      }
      if (buster.state === 0 && !buster.helping) {
        // Moving
        printErr(buster.toString());
        const shouldDefend = this.shouldDefendLast(buster);
        if (shouldDefend === 2) {
          return;
        }

        let { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(buster, mapData.sighedBusters, -1, [0, 2, 3]);
        if (!closestEnnemy || ennemyDistance > 1760) {
          ({ closest: closestEnnemy, minDist: ennemyDistance }
            = getClosest(buster, mapData.sighedBusters, -1, [2]));
        }
        if (closestEnnemy) {
          if (ennemyDistance < 1760
            && buster.isStunAvailable()) {
            buster.stun(closestEnnemy.id);
            const ghost = mapData.getGhost(closestEnnemy.value);
            if (ghost) {
              ghost.giveUp = false;
            } else if (closestEnnemy.value !== -1) {
              const estimatedNextPos = getNextPos([closestEnnemy.x, closestEnnemy.y], [this.ennemyX, this.ennemyY]);
              mapData.createOrUpdateGhost(closestEnnemy.value, estimatedNextPos.x, estimatedNextPos.y, 0, 0);
            }
            return;
          } else if (ennemyDistance < 2200) {
            let ennemyToBase = getDistance2([closestEnnemy.x, closestEnnemy.y], [this.ennemyX, this.ennemyY]);
            const distanceToEnnemyBase = getDistance2([buster.x, buster.y], [this.ennemyX, this.ennemyY]);
            if (closestEnnemy.state === 1 && distanceToEnnemyBase > ennemyToBase) {
              this.goToBase(buster, true);
              ennemyToBase = this.goToBase(closestEnnemy, true);
              printErr('Nb turn to base to intercept', Math.ceil(ennemyToBase / 800), ennemyToBase);
              if (Math.ceil(ennemyToBase / 800) - 1 > buster.stunCD) {
                return;
              }
            } else {
              const nbTurnToGo = Math.ceil((ennemyDistance - 1760) / 800);
              printErr('Nb turn to ennemy to intercept', nbTurnToGo, ennemyDistance);
              if (buster.isStunAvailable() || buster.stunCD < nbTurnToGo) {
                buster.goTo(closestEnnemy.x, closestEnnemy.y);
                return;
              }
            }
          }
        }

        printErr(mapData.ghosts.map((ghost) => ghost.toString()));
        const inSigh = getSighed(buster, mapData.ghosts);
        let closest;
        let minDist;
        inSigh.forEach(({ currentEntity, currentDist }) => {
          // const nbTurnToGo = Math.ceil((currentDist - 1760) / 800);
          if (!currentEntity.giveUp &&
            (!closest
              // || (currentEntity.state < closest.state && closest.state - closest.value * nbTurnToGo > 0)
              || currentEntity.state < closest.state
              // || currentDist < minDist
            )) {
            closest = currentEntity;
            minDist = currentDist;
          }
        });
        if (!closest) {
          ({ closest, minDist } = getClosest(buster, mapData.ghosts));
        }
        // const { closest, minDist } = getClosest(buster, mapData.ghosts);
        if (closest && !closest.giveUp) {
          printErr('Go for', closest.id);
          if (minDist < 1760 && minDist >= 900) {
            buster.bust(closest.id);
            if (buster.state !== 3) {
              closest.value++;
              buster.value = closest.id;
              buster.state = 3;
            }
          } else if (minDist < 900) {
            const ennemyInSigh = getSighed(buster, mapData.sighedBusters);
            let countEnnemies = 0;
            ennemyInSigh.forEach((ennemy) => {
              const ennemyToGhost = getDistance(ennemy, closest);
              if (ennemyToGhost > 900 && ennemyToGhost < 1760) {
                countEnnemies++;
              }
            });
            if (countEnnemies > 0) {
              this.goToBase(buster, true);
              return;
            }
            this.goToBase(buster);
          } else {
            const nbTurnToGo = Math.ceil((minDist - 1760) / 800);
            if (closest.value > 0 && closest.state - closest.value * nbTurnToGo > 0
              || closest.value === 0 && closest.state - nbTurnToGo > 0
              || closest.state === 0
              || minDist < 2200
            ) {
              buster.goTo(closest.x, closest.y);
            } else if (!this.shouldRoam(buster, shouldDefend)) {
              printErr('Too far');
              buster.currentAction = 'IDLE';
              this.search(buster);
            }
          }
        } else if (!this.shouldRoam(buster, shouldDefend)) {
          this.search(buster);
        }
      }
      if (buster.state === 2) {
        this.search(buster);
      }
    });
  }

  shouldRoam(buster, shouldDefend) {
    if (shouldDefend === 1 && mapData.sighedGhosts.length === 0 && !buster.roam) {
      printErr('Desperate attack', buster.id);
      this.goToBase(buster, true, 1700);
      buster.roam = true;
      return true;
    }

    if (buster.roam && getDistance2([buster.x, buster.y], [this.ennemyX, this.ennemyY]) < 3000) {
      this.roam(buster);
      printErr('Roaming', buster.goingLeft);
      return true;
    }
    return false;
  }

  roam(buster) {
    let left = {
      x: 1000,
      y: 2500
    };
    let right = {
      x: 2500,
      y: 1000
    };
    if (mapData.myTeamId === 0) {
      left = {
        x: 13500,
        y: 8000
      };
      right = {
        x: 15000,
        y: 6500
      };
    }
    if (buster.goingLeft && buster.x !== left.x && buster.y !== left.y) {
      buster.goTo(left.x, left.y);
      buster.goingLeft = true;
    } else if (buster.x !== right.x && buster.y !== right.y) {
      buster.goTo(right.x, right.y);
      buster.goingLeft = false;
    } else {
      buster.goingLeft = true;
      buster.goTo(left.x, left.y);
    }
  }

  updateStealers(buster) {
    const inSigh = getSighed(buster, mapData.stealers);
    printErr('Updating stealers', inSigh.map(({ currentEntity }) => currentEntity.id));
    inSigh.forEach(({ currentEntity }) => {
      let isStillHere = false;
      mapData.sighedBusters.forEach((sighedBuster) => {
        if (currentEntity.id === sighedBuster.id && sighedBuster.state !== 2) {
          isStillHere = true;
        }
      });
      if (!isStillHere) {
        mapData.stealers.forEach((stealer, index) => {
          if (stealer.id === currentEntity.id) {
            mapData.stealers.splice(index, 0);
          }
        });
      }
    });

    mapData.sighedBusters.forEach((sighedBuster) => {
      const distMeToHim = getDistance(buster, sighedBuster);
      const distMeToBase = getDistance2([buster.x, buster.y], [this.x, this.y]);
      const distHimToBase = getDistance2([sighedBuster.x, sighedBuster.y], [this.x, this.y]);
      let found = false;
      mapData.stealers.forEach((stealer) => {
        if (stealer.id === sighedBuster.id) {
          found = true;
        }
      });
      if (!found && distMeToHim < 2200
        && distMeToBase > distHimToBase - 800
        && sighedBuster.state !== 2) {
        mapData.stealers.push(sighedBuster);
      }
    });
  }

  askProtection(buster, wanted) {
    this.closestBusters = [];
    this.busters.forEach((currentBuster) => {
      if (buster.id !== currentBuster.id) {
        this.closestBusters.push(currentBuster);
      }
    });
    this.closestBusters.sort((buster1, buster2) => {
      const nbTurnToGo1 = Math.ceil((getDistance(buster, buster1) - 950) / 800);
      const nbTurnToGo2 = Math.ceil((getDistance(buster, buster2) - 950) / 800);
      if (nbTurnToGo1 + buster1.stunCD < nbTurnToGo2 + buster2.stunCD) {
        return -1;
      } else if (nbTurnToGo1 + buster1.stunCD > nbTurnToGo2 + buster2.stunCD) {
        return 1;
      }
      return 0;
    });
    this.closestBusters.forEach((currentBuster, index) => {
      printErr('Will help?', currentBuster.id);
      const nbTurnToGo = Math.ceil((getDistance(buster, currentBuster) - 950) / 800);
      if (index < wanted && nbTurnToGo > currentBuster.stunCD) {
        currentBuster.helping = true;
        const distMeToHim = getDistance(buster, currentBuster);
        const { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(currentBuster, mapData.sighedBusters, -1, [2]);
        printErr('Helping', currentBuster.id, ennemyDistance);
        if (closestEnnemy
          && ennemyDistance < 1760 && currentBuster.isStunAvailable()) {
          const ennemyToCarrier = getDistance(closestEnnemy, buster);
          if (ennemyToCarrier < 1760 && buster.isStunAvailable()) {
            buster.stun(closestEnnemy.id);
            closestEnnemy.state = 2;
            return;
          }
          currentBuster.stun(closestEnnemy.id);
          closestEnnemy.state = 2;
        } else if (distMeToHim > 1000) {
          const nextPos = getNextPos([buster.x, buster.y], [this.x, this.y], 950);
          currentBuster.goTo(nextPos.x, nextPos.y);
        } else {
          this.goToBase(currentBuster);
        }
      }
    });
    let countCloseBusters = 0;
    this.closestBusters.forEach((currentBuster) => {
      const distMeToHim = getDistance(buster, currentBuster);
      const distMeToBase = getDistance2([buster.x, buster.y], [this.x, this.y]);
      const distHimToBase = getDistance2([currentBuster.x, currentBuster.y], [this.x, this.y]);
      if (currentBuster.isStunAvailable() && (distMeToHim < 300 || distMeToBase >= distHimToBase)) {
        printErr('Is close', currentBuster.id);
        countCloseBusters++;
      }
    });
    return countCloseBusters;
  }

  carryingDecision(buster) {
    // Carrying
    mapData.release(buster.value);
    if (mapData.stealers.length > 0) {
      printErr('Stealers', mapData.stealers.map((stealer) => stealer.id));
      const closeBusters = this.askProtection(buster, mapData.stealers.length - 1);
      const distanceToBase = getDistance([buster.x, buster.y], [this.x, this.y]);
      if (distanceToBase < 4000 && (closeBusters < mapData.stealers.length - 1 || !buster.isStunAvailable())) {
        printErr('Waiting for help', closeBusters);
        return;
      }
    }

    if (buster.isInBaseRange()) {
      buster.release();
      return;
    }
    const { closest: closestEnnemy, minDist: ennemyDistance }
      = getClosest(buster, mapData.sighedBusters, -1, [2]);
    if (closestEnnemy) {
      printErr('Avoid?', closestEnnemy.id);
      if (ennemyDistance > 1760
      ) {
        this.avoid(buster, closestEnnemy);
        return;
      } else if (buster.isStunAvailable()) {
        buster.stun(closestEnnemy.id);
        closestEnnemy.state = 2;
        printErr('Stun first!', closestEnnemy.id);
        return;
      }
      // const oppositePosition = getNextPos([closestEnnemy.x, closestEnnemy.y], [buster.x, buster.y], 1800);
      // buster.goTo(oppositePosition.x, oppositePosition.y);
      printErr('Too close :(', closestEnnemy.id);
      // return;
    }
    this.goToBase(buster);
    return;
  }

  shouldDefendLast(buster) {
    if (mapData.score === ((mapData.nbGhosts - 1) / 2)) {
      printErr('Last ghost needed to win!');
      let carryingBuster = null;
      let minDist = 100000;
      this.busters.forEach((currentBuster) => {
        const distance = getDistance(buster, currentBuster);
        if (currentBuster.state === 1 && currentBuster.action !== 'RELEASE' && distance < minDist) {
          carryingBuster = currentBuster;
          minDist = distance;
        }
      });
      if (carryingBuster) {
        printErr(buster.id, 'Defend', carryingBuster.id);
        const { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(buster, mapData.sighedBusters, -1, [2]);
        if (closestEnnemy
          && ennemyDistance < 1760 && buster.isStunAvailable()) {
          buster.stun(closestEnnemy.id);
          closestEnnemy.state = 2;
        } else {
          buster.goTo(carryingBuster.x, carryingBuster.y);
        }
        return 2;
      }
      printErr('No carry :(', this.busters.map((currentBuster) => currentBuster.toString()));
      return 1;
    }
    return 0;
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
      if (ghost.state === 0 && ennemyTrapping < teamTrapping - 1) {
        mapData.release(ghost.id);
      }
    }
  }

  avoid(buster, ennemy) {
    printErr(buster.id, 'avoid', ennemy.id);

    const nextPosToBase = getNextPos([buster.x, buster.y], [this.x, this.y]);
    const nextPosToEnnemyDistance = getDistance2([nextPosToBase.x, nextPosToBase.y], [ennemy.x, ennemy.y]);
    if (nextPosToEnnemyDistance > 2563) {
      this.goToBase(buster);
      return;
    }

    const ennemyRange = Math.pow(2563, 2);
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
    printErr('Giving up', buster.value);
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

  goToBase(buster, ennemy = false, baseRange = 1597) {
    printErr(buster.id, 'goToBase');
    const baseX = ennemy ? this.ennemyX : this.x;
    const baseY = ennemy ? this.ennemyY : this.y;
    const roundFunc = roundForBase(baseX);
    if ((buster.x - baseX) !== 0) {
      const a = (buster.y - baseY) / (buster.x - baseX);
      const b = buster.y - a * buster.x;
      const A = 1 + Math.pow(a, 2);
      const B = 2 * (a * (b - baseY) - baseX);
      const C = Math.pow(baseX, 2) +
        Math.pow((b - baseY), 2) - Math.pow(baseRange, 2);
      const delta = Math.pow(B, 2) - 4 * A * C;
      const x1 = roundFunc((- B - Math.sqrt(delta)) / (2 * A));
      const x2 = roundFunc((- B + Math.sqrt(delta)) / (2 * A));
      const y1 = roundFunc(a * x1 + b);
      const y2 = roundFunc(a * x2 + b);
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
    const distance = getDistance2([buster.x, buster.y], [buster.x, Math.abs(baseY - 1600)]);
    return distance;
  }

  toString() {
    return this.busters.map((buster) => buster.toString());
  }
}
