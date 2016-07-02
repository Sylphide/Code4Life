import { mapData } from './MapData';

export function getDistance2([x1, y1], [x2, y2]) {
  return Math.ceil(Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2)));
}

export function getDistance(entity1, entity2) {
  return getDistance2([entity1.x, entity1.y], [entity2.x, entity2.y]);
}

export function getClosest(entity, entities, exceptId = -1, exceptState = [], withStun = false) {
  let minDist = 100000;
  let closest = null;
  entities.forEach((currentEntity) => {
    const currentDist = getDistance(entity, currentEntity);
    if (minDist > currentDist && currentEntity.id !== exceptId
      && exceptState.indexOf(currentEntity.state) === -1
      && (!withStun || currentEntity.stunCD < 2)) {
      minDist = currentDist;
      closest = currentEntity;
    }
  });
  return {
    closest,
    minDist
  };
}

export function getClosestFrom(buster, ennemies, [baseX, baseY]) {
  let minDist = 100000;
  let closest = null;
  ennemies.forEach((ennemy) => {
    const currentDist = getDistance(buster, ennemy);
    const distToBase = getDistance2([ennemy.x, ennemy.y], [baseX, baseY]);
    if (currentDist < 1760 && distToBase < minDist && ennemy.state === 3) {
      minDist = currentDist;
      closest = ennemy;
    }
  });
  return {
    closest,
    minDist
  };
}

export function getSighed(entity, entities, range = 2200) {
  const result = [];
  entities.forEach((currentEntity) => {
    const currentDist = getDistance(entity, currentEntity);
    if (currentDist < range) {
      result.push({
        currentEntity,
        currentDist
      });
    }
  });
  return result;
}

export function roundForBase(baseX) {
  if (baseX === 0) {
    return Math.floor;
  }
  return Math.ceil;
}

export function getCell(x, y) {
  const row = Math.floor(x / 2001);
  const column = Math.floor(y / 1501);
  return mapData.grid[row + column * 8];
}

export function cleanCoords(x, y) {
  let cleanX = x;
  let cleanY = y;
  if (x < 0) {
    cleanX = 0;
  } else if (x > 16000) {
    cleanX = 16000;
  }

  if (y < 0) {
    cleanY = 0;
  } else if (y > 9000) {
    cleanY = 9000;
  }
  return {
    x: cleanX,
    y: cleanY
  };
}

function roundForDest(sourceX, sourceY, destX, destY) {
  let roundX = Math.floor;
  let roundY = Math.floor;
  if (sourceX > destX) {
    roundX = Math.ceil;
  }
  if (sourceY > destY) {
    roundY = Math.ceil;
  }
  return {
    roundX,
    roundY
  };
}

export function getNextPos([sourceX, sourceY], [destX, destY], dist = 799, opposite = false) {
  const roundFunc = roundForDest(sourceX, sourceY, destX, destY);
  if ((sourceX - destX) !== 0) {
    const a = (sourceY - destY) / (sourceX - destX);
    const b = sourceY - a * sourceX;
    const A = 1 + Math.pow(a, 2);
    const B = 2 * (a * (b - sourceY) - sourceX);
    const C = Math.pow(sourceX, 2) +
      Math.pow((b - sourceY), 2) - Math.pow(dist, 2);
    const delta = Math.pow(B, 2) - 4 * A * C;
    const x1 = roundFunc.roundX((- B - Math.sqrt(delta)) / (2 * A));
    const x2 = roundFunc.roundX((- B + Math.sqrt(delta)) / (2 * A));
    const y1 = roundFunc.roundY(a * x1 + b);
    const y2 = roundFunc.roundY(a * x2 + b);
    const distance1 = getDistance2([destX, destY], [x1, y1]);
    const distance2 = getDistance2([destX, destY], [x2, y2]);
    if (distance1 < distance2 || (opposite && distance1 >= distance2)) {
      return {
        x: x1,
        y: y1
      };
    }
    return {
      x: x2,
      y: y2
    };
  }
  return {
    x: sourceX,
    y: sourceY < destY || (opposite && destY >= sourceY) ? sourceY + 800 : sourceY - 800
  };
}
