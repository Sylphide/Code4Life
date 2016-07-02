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

  behaviour(buster) {
    const distanceToBase = getDistance2([buster.x, buster.y], [this.x, this.y]);
    if (buster.helping) {
      printErr(buster.id, 'Helping', buster.helpingOn);
    }
    if (distanceToBase < 6000) {
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
        = getClosest(buster, mapData.sighedBusters, -1, [0, 2, 3, 4]);
      if (!closestEnnemy || ennemyDistance > 1760) {
        ({ closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(buster, mapData.sighedBusters, -1, [2, 4]));
      }
      if (closestEnnemy) {
        const ennemyToBase = getDistance2([closestEnnemy.x, closestEnnemy.y], [this.x, this.y]);

        // A REVOIR
        let ennemyToHisBase = getDistance2([closestEnnemy.x, closestEnnemy.y], [this.ennemyX, this.ennemyY]);
        let tooSoon = false;
        const { closestGhost } = getClosest(buster, mapData.sighedGhosts);
        const ghostDistance = closestGhost ? getDistance(closestEnnemy, closestGhost) : 100000;
        if (closestEnnemy.value !== -1) {
          const ghost = mapData.getGhost(closestEnnemy.value);
          if (ghost) {
            printErr('tooSoon', buster.id, ghost.state, ghost.value, ghost.state - ghost.value * 10);
            tooSoon = ghost.state - ghost.value * 9 > 0 && closestEnnemy.state !== 1;
          }
        }
        printErr('shouldStun?', closestEnnemy.toString(), ennemyToBase);
        if (ennemyDistance < 1760 && buster.isStunAvailable() && ennemyToBase > 3500
          && (ennemyToHisBase < 3500 || closestEnnemy.state === 1) // A REVOIR
            || (closestGhost && closestGhost.state === 0 && ghostDistance < 1760) // A REVOIR
          && !tooSoon // A Revoir
          // && !(_MapData.mapData.turn > 170 && _MapData.mapData.turn < 190)
        ) {
          buster.stun(closestEnnemy.id);
          closestEnnemy.willBeStunBy = buster;
          closestEnnemy.state = 4;
          const ghost = mapData.getGhost(closestEnnemy.value);
          if (ghost) {
            ghost.giveUp = false;
          } else if (closestEnnemy.value !== -1) {
            const estimatedNextPos = getNextPos([closestEnnemy.x, closestEnnemy.y], [this.ennemyX, this.ennemyY]);
            mapData.createOrUpdateGhost(closestEnnemy.value, estimatedNextPos.x, estimatedNextPos.y, 0, 0);
            const newGhost = mapData.getGhost(closestEnnemy.value);
            newGhost.notYet = true;
          }
          return;
        } else if (ennemyDistance < 2200 && ennemyToBase > 3500
          && !tooSoon
        ) {
          if (closestEnnemy.willBeStunBy) {
            printErr(closestEnnemy.id, closestEnnemy.willBeStunBy.toString());
          }
          const distanceToEnnemyBase = getDistance2([buster.x, buster.y], [this.ennemyX, this.ennemyY]);
          if (closestEnnemy.state === 1 && distanceToEnnemyBase > ennemyToHisBase) {
            this.goToBase(buster, true);
            ennemyToHisBase = this.goToBase(closestEnnemy, true);
            printErr('Nb turn to base to intercept', Math.ceil(ennemyToHisBase / 800), ennemyToHisBase);
            if (Math.ceil(ennemyToHisBase / 800) - 1 > buster.stunCD) {
              return;
            }
          } else if (closestEnnemy.state === 1) { // ATTENTION
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
      const { closest, minDist } = this.getBestGhost(buster);
      if (closest) {
        printErr('Go for', closest.toString());
        if (minDist < 1760 && minDist >= 900) {
          buster.bust(closest.id);
          if (buster.state !== 3) {
            closest.value++;
            closest.state--;
            buster.value = closest.id;
            buster.state = 3;
          }
        } else if (minDist < 900) {
          const ennemyInSigh = getSighed(buster, mapData.sighedBusters);
          let countEnnemies = 0;
          ennemyInSigh.forEach((ennemy) => {
            const ennemyToGhost = getDistance(ennemy, closest);
            if (ennemy.state !== 2 && ennemyToGhost > 900 && ennemyToGhost < 1760) {
              countEnnemies++;
            }
          });
          if (countEnnemies > 0) {
            this.goToBase(buster, true);
            return;
          }
          const nextPosToBase = getNextPos([buster.x, buster.y], [this.x, this.y], 600);
          buster.goTo(nextPosToBase.x, nextPosToBase.y);
        } else {
          buster.goTo(closest.x, closest.y);
        }
      } else if (!this.shouldRoam(buster, shouldDefend)) {
        printErr('None good found');
        this.search(buster);
      }
    }
    if (buster.state === 2) {
      this.search(buster);
    }
  }

  getBestGhost(buster) {
    let bestGhost;
    let minDist;
    // let minDistToBase;
    // inSigh.forEach(({ currentEntity, currentDist }) => {
    mapData.ghosts.forEach((ghost) => {
      const currentDist = getDistance(ghost, buster);
      // const currentDistToBase = getDistance2([ghost.x, ghost.y], [this.ennemyX, this.ennemyY]);
      const nbTurnToGo = Math.ceil((currentDist - 1760) / 800);
      let countEnnemies = 0;
      mapData.sighedBusters.forEach((ennemy) => {
        const ennemyToGhost = getDistance(ennemy, ghost);
        if (ennemy.state !== 2 && ennemyToGhost > 900 && ennemyToGhost < 1760) {
          countEnnemies++;
        }
      });
      const isBustable = currentDist < 1760 && currentDist > 900;
      const isReachable = ((ghost.value > 0 && ghost.state - ghost.value * nbTurnToGo > 0)
        || (ghost.value === 0 && (countEnnemies === 0 || isBustable))
        || ghost.state === 0
      );
      // const perime = ghost.lastSeen > 10;
      const perime = false;
      const onlyWeak = ((mapData.turn < 2 * mapData.nbGhosts && ghost.state <= 3 && (ghost.value < 1 || nbTurnToGo === 1))
        || (mapData.turn >= 2 * mapData.nbGhosts && mapData.turn < 3 * mapData.nbGhosts && ghost.state <= 15)
        || mapData.turn >= 3 * mapData.nbGhosts
        || mapData.ghosts.length + mapData.score >= (mapData.nbGhosts - ((mapData.nbGhosts - 1) / 3))
      );
      // const onlyWeak = true
      if (!ghost.giveUp
          && isReachable
          && onlyWeak
          && !perime
          && (!bestGhost || ghost.state < bestGhost.state)
        ) {
        bestGhost = ghost;
        minDist = currentDist;
        // minDistToBase = currentDistToBase;
      }
    });
    return {
      closest: bestGhost,
      minDist
    };
  }

  makeDecision() {
    this.busters.forEach((buster) => {
      this.behaviour(buster);
    });
  }

  shouldRoam(buster, shouldDefend) {
    if (shouldDefend === 1 && mapData.ghosts.length === 0
      && mapData.nbBusterDesperate < mapData.stealers.length - 1 && !buster.roam) {
      printErr('Desperate attack', buster.id);
      this.goToBase(buster, true, 1700);
      buster.roam = true;
      mapData.nbBusterDesperate++;
      return true;
    }

    if (buster.roam && getDistance2([buster.x, buster.y], [this.ennemyX, this.ennemyY]) < 3000) {
      this.roam(buster);
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
    printErr('Updating stealers', buster.id, inSigh.map(({ currentEntity }) => currentEntity.id));
    mapData.sighedBusters.forEach((sighedBuster) => {
      const distMeToHim = getDistance(buster, sighedBuster);
      const distMeToBase = getDistance2([buster.x, buster.y], [this.x, this.y]);
      const distHimToBase = getDistance2([sighedBuster.x, sighedBuster.y], [this.x, this.y]);
      let found = false;
      let foundIndex = -1;
      mapData.stealers.forEach((stealer, index) => {
        if (stealer.id === sighedBuster.id) {
          found = true;
          foundIndex = index;
          stealer.state = sighedBuster.state;
          stealer.x = sighedBuster.x;
          stealer.y = sighedBuster.y;
        }
      });
      if (!found && distMeToHim < 2200 && (distHimToBase - 800) < distMeToBase) {
        printErr('Adding stealer', sighedBuster.toString());
        mapData.stealers.push(sighedBuster);
      } else if (found && distHimToBase > 4000) {
        printErr('Removing stealer elsewhere', sighedBuster.id);
        mapData.stealers.splice(foundIndex, 1);
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
      const nbTurnToGo = Math.ceil((getDistance(buster, currentBuster) - 950) / 800);
      printErr('Will help?', currentBuster.id, nbTurnToGo);
      if (index < wanted && (nbTurnToGo === 0 || nbTurnToGo > currentBuster.stunCD)) {
        currentBuster.helping = true;
        currentBuster.helpingOn = buster.id;
        const distMeToHim = getDistance(buster, currentBuster);
        const { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(currentBuster, mapData.sighedBusters, -1, [2, 4]);
        printErr('Helping', currentBuster.id, ennemyDistance);
        if (closestEnnemy && ennemyDistance < 1760 && currentBuster.isStunAvailable()) {
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
    const distanceToBase = getDistance2([buster.x, buster.y], [this.x, this.y]);
    if (mapData.stealers.length > 0) {
      printErr('Stealers', mapData.stealers.map((stealer) => stealer.id));
      let countThreats = buster.isStunAvailable() ? 0 : 1;
      mapData.stealers.forEach((stealer) => {
        if (stealer.state !== 2) {
          countThreats++;
        }
      });
      countThreats = this.busters.length === countThreats ? countThreats - 1 : countThreats;
      const closeBusters = this.askProtection(buster, countThreats);
      let stealerClose = false;
      let stunnedStealerClose = false;
      mapData.stealers.forEach((stealer) => {
        if (getDistance(stealer, buster) < 2200 && stealer.state !== 2) {
          printErr(stealer.id, stealer.state);
          stealerClose = true;
        } else if (stealer.state === 2) {
          stunnedStealerClose = true;
        }
      });
      if (distanceToBase > 2400 && distanceToBase < 6000
        && closeBusters < countThreats) {
        if (!stealerClose) {
          printErr('Waiting for help', closeBusters, distanceToBase, buster.stunCD);
          buster.goTo(buster.x, buster.y);
          return;
        } else if (!stealerClose && stunnedStealerClose) {
          printErr('Waiting for help and avoiding', closeBusters, distanceToBase, buster.stunCD);
          const { closest: closestTeam }
            = getClosest(buster, this.busters, buster.id);
          buster.goTo(closestTeam.x, closestTeam.y);
          return;
        }
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
        const busterWouldStun = closestEnnemy.willBeStunBy;
        if (busterWouldStun) {
          closestEnnemy.willBeStunBy = null;
          this.behaviour(busterWouldStun);
        }
        printErr('Stun first!', closestEnnemy.id);
        return;
      }
      printErr('Too close :(', closestEnnemy.id);
      const { closest: closestAlly, minDist: allyDistance } = getClosest(buster, this.busters, buster.id);
      if (allyDistance < 2200) {
        buster.goTo(closestAlly.x, closestAlly.y);
        this.askProtection(buster, 1);
        return;
      }
    }

    if (distanceToBase > 5000 && mapData.sighedBusters.length === 0
      && (mapData.turn > 180 || mapData.score === (mapData.nbGhosts - 1) / 2)
    ) {
      if (mapData.myTeamId === 0) {
        buster.goTo(0, 9000);
        return;
      }
      buster.goTo(16000, 0);
      return;
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
          const nextPos = getNextPos([carryingBuster.x, carryingBuster.y], [this.x, this.y], 950);
          buster.goTo(nextPos.x, nextPos.y);
        }
        return 2;
      }
      mapData.sighedBusters.forEach((currentBuster) => {
        if (currentBuster.state === 1) {
          carryingBuster = currentBuster;
        }
      });
      if (carryingBuster) {
        printErr(buster.id, 'chasing', carryingBuster.id);
        let { closest: closestEnnemy, minDist: ennemyDistance }
          = getClosest(buster, mapData.sighedBusters, -1, [0, 2, 3]);
        if (!closestEnnemy) {
          ({ closest: closestEnnemy, minDist: ennemyDistance }
            = getClosest(buster, mapData.sighedBusters, -1, [2]));
        }
        if (closestEnnemy
          && ennemyDistance < 1760 && buster.isStunAvailable()) {
          buster.stun(closestEnnemy.id);
          closestEnnemy.state = 2;
        } else {
          if (!carryingBuster.isFollowed || buster.id === carryingBuster.isFollowedBy) {
            buster.goTo(carryingBuster.x, carryingBuster.y);
            carryingBuster.isFollowed = true;
            carryingBuster.isFollowedBy = buster.id;
          } else {
            const nextPos = getNextPos([carryingBuster.x, carryingBuster.y], [this.ennemyX, this.ennemyY]);
            buster.goTo(nextPos.x, nextPos.y);
          }
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
    const { closest: closestEnnemy, minDist: ennemyDistance }
      = getClosest(buster, mapData.sighedBusters, -1, [2, 4]);
    const ghost = mapData.getGhost(buster.value);
    let teamTrapping = -1;
    let ennemyTrapping = -1;
    let tooSoon = false;
    if (ghost) {
      teamTrapping = this.getNbTeamTrapping(ghost.id);
      ennemyTrapping = ghost.value - teamTrapping;
      const numberLeft = ghost.value + (closestEnnemy && closestEnnemy.value === ghost.id ? -1 : 0);
      tooSoon = (ghost.state - numberLeft * 9 > 0 && (!closestEnnemy || closestEnnemy.state !== 1));
      printErr('tooSoon', buster.id, ghost.state, ghost.value, ghost.state - numberLeft * 9, tooSoon);
    }
    if (closestEnnemy
      && !tooSoon
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
      } else if (closestEnnemy
        && !tooSoon
        && buster.isStunAvailable()
      ) {
        if (ennemyDistance < 1760) {
          buster.stun(closestEnnemy.id);
          closestEnnemy.state = 2;
          return;
        } else if (ennemyDistance < 2200) {
          buster.goTo(closestEnnemy.x, closestEnnemy.y);
          return;
        }
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
    printErr(getDistance2([nextPosToBase.x, nextPosToBase.y], [this.x, this.y]));
    if (nextPosToEnnemyDistance > 2563) {
      this.goToBase(buster);
      return;
    }

    const ennemyRange = Math.pow(2400, 2);
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
      let closestCellId = -1;
      mapData.grid.forEach((cell, index) => {
        const distance = getDistance2([buster.x, buster.y], [cell.x, cell.y]);
        if (distance > 2200 && distance < minDist && !cell.noGhost && !cell.searched) {
          closestCell = cell;
          closestCellId = index;
          minDist = distance;
        }
      });
      if (closestCell) {
        closestCell.searched = true;
        printErr(buster.id, 'search to', closestCellId);
        buster.goTo(closestCell.x, closestCell.y);
      } else {
        printErr(buster.id, 'search to', closestCellId);
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
