import { mapData } from './MapData';

export function getDistance2([x1, y1], [x2, y2]) {
  return Math.round(Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2)));
}

export function getDistance(entity1, entity2) {
  return getDistance2([entity1.x, entity1.y], [entity2.x, entity2.y]);
}

export function getClosest(entity, entities) {
  let minDist = 100000;
  let closest = null;
  entities.forEach((currentEntity) => {
    const currentDist = getDistance(entity, currentEntity);
    if (minDist > currentDist) {
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

export function getCell(x, y) {
  const row = Math.floor(x / 2001);
  const column = Math.floor(y / 1501);
  return mapData.grid[row + column * 8];
}
