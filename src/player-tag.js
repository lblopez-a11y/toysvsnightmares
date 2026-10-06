export const ADMIN_ID='LAUTAROLOPEZ#ujCQFK9v1BaDtqj0G5cnjEiEAC02';

export function isAdminPlayer(playerData){
  return playerData?.tag===ADMIN_ID;
}
