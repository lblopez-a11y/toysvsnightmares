import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_TAG,renderPlayerTag} from '../src/player-tag.js';

test('la etiqueta legendaria solo se renderiza para el tag exacto configurado',()=>{
 assert.equal(ADMIN_TAG,'LAUTAROLOPEZ#ujCQFK9v1BaDtqj0G5cnjEiEAC02');
 assert.equal(renderPlayerTag({tag:ADMIN_TAG}),'<span class="badge-admin-legendary">👑 ADMIN</span>');
 assert.equal(renderPlayerTag({id:ADMIN_TAG}),'<span class="badge-admin-legendary">👑 ADMIN</span>');
 assert.equal(renderPlayerTag({playerTag:ADMIN_TAG}),'<span class="badge-admin-legendary">👑 ADMIN</span>');
 assert.equal(renderPlayerTag({tag:ADMIN_TAG.toLowerCase()}),'');
 assert.equal(renderPlayerTag({uid:'ujCQFK9v1BaDtqj0G5cnjEiEAC02'}),'');
 assert.equal(renderPlayerTag({tag:'LAUTAROLOPEZ#otro-id'}),'');
 assert.equal(renderPlayerTag(null),'');
});
