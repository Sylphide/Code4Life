import { mapData } from './MapData';
import { getCell } from './Utils';

export default class Cell {

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.noGhost = false;
  }

  updateHasGhost() {
    this.noGhost = true;
    // const possibleGhosts = [];
    mapData.ghosts.forEach((ghost) => {
      const ghostCell = getCell(ghost.x, ghost.y);
      if (ghostCell.x === this.x && ghostCell.y === this.y) {
        // possibleGhosts.push(ghost);
        this.noGhost = false;
      }
    });
    // possibleGhosts.forEach((possibleGhost) => {
    //   let isRealGhost = false;
    //   mapData.sighedGhosts.forEach((ghost) => {
    //     if (ghost.id === possibleGhost.id) {
    //       printErr('realGhost', possibleGhost.id);
    //       isRealGhost = true;
    //       this.noGhost = false;
    //     }
    //   });
    //   if (!isRealGhost) {
    //     mapData.release(possibleGhost.id);
    //   }
    // });
  }
}
