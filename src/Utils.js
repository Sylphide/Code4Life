import { mapData } from './MapData';

export function getDistance2([x1, y1], [x2, y2]) {
  return Math.ceil(Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2)));
}

export function getDistance(entity1, entity2) {
  return getDistance2([entity1.x, entity1.y], [entity2.x, entity2.y]);
}

export function getClosest(entity, entities, exceptId = -1) {
  let minDist = 100000;
  let closest = null;
  entities.forEach((currentEntity) => {
    const currentDist = getDistance(entity, currentEntity);
    if (minDist > currentDist && currentEntity.id !== exceptId) {
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

export function getSighed(entity, entities) {
  const result = [];
  entities.forEach((currentEntity) => {
    const currentDist = getDistance(entity, currentEntity);
    if (currentDist < 2200) {
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
