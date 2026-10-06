import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_ID,isAdminPlayer} from '../src/player-tag.js';

test('la etiqueta ADMIN solo corresponde al tag exacto configurado',()=>{
 assert.equal(ADMIN_ID,'LAUTAROLOPEZ#ujCQFK9v1BaDtqj0G5cnjEiEAC02');
 assert.equal(isAdminPlayer({tag:ADMIN_ID}),true);
 assert.equal(isAdminPlayer({tag:ADMIN_ID.toLowerCase()}),false);
 assert.equal(isAdminPlayer({uid:'ujCQFK9v1BaDtqj0G5cnjEiEAC02'}),false);
 assert.equal(isAdminPlayer({tag:'LAUTAROLOPEZ#otro-id'}),false);
});
