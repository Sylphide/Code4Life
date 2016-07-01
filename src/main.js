import Team from './Team';
import { mapData } from './MapData';

const bustersPerPlayer = parseInt(readline()); // the amount of busters you control
const ghostCount = parseInt(readline()); // the amount of ghosts on the map
const myTeamId = parseInt(readline()); // if this is 0, your base is on the top left of the map, if it is one, on the bottom right
const myTeam = new Team(myTeamId);
mapData.setGhostsCount(ghostCount);
mapData.setMyTeamId(myTeamId);
// let firstRound = true;

// game loop
while (true) {
  const entities = parseInt(readline()); // the number of busters and ghosts visible to you
  mapData.turn++;
  mapData.clearInstantData();
  for (let i = 0; i < entities; i++) {
    const inputs = readline().split(' ');
    const entityId = parseInt(inputs[0]); // buster id or ghost id
    const x = parseInt(inputs[1]);
    const y = parseInt(inputs[2]); // position of this buster / ghost
    const entityType = parseInt(inputs[3]); // the team id if it is a buster, -1 if it is a ghost.
    const state = parseInt(inputs[4]); // For busters: 0=idle, 1=carrying a ghost.
    const value = parseInt(inputs[5]); // For busters: Ghost id being carried. For ghosts: number of busters attempting to trap this ghost.
    if (entityType === myTeamId) {
      myTeam.createOrUpdateBuster(entityId, x, y, entityType, state, value);
    } else {
      mapData.addSighedEntity(entityId, x, y, entityType, state, value);
    }
  }
  mapData.cleanFalseGhost(myTeam.busters);
  myTeam.updateHasGhost();
  mapData.printErr();
  printErr('Turn', mapData.turn);
  printErr('myTeam', myTeam.toString());

  myTeam.makeDecision();
  for (let i = 0; i < bustersPerPlayer; i++) {
    print(myTeam.busters[i].action);
  }
}
