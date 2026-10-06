export const ADMIN_TAG='LAUTAROLOPEZ#ujCQFK9v1BaDtqj0G5cnjEiEAC02';

export function renderPlayerTag(player){
  if(!player)return '';
  const tag=player.tag||player.id||player.playerTag||'';
  return tag===ADMIN_TAG?'<span class="badge-admin-legendary">👑 ADMIN</span>':'';
}
