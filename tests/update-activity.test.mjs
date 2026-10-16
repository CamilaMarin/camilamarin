import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderActivity, replaceActivity, fetchPublicEvents } from '../scripts/update-activity.mjs';
const event = (repo = 'CamilaMarin/sky', extra = {}) => ({ type:'PushEvent', public:true, actor:{login:'CamilaMarin'}, repo:{name:repo}, payload:{}, ...extra });
test('push sin cantidad de commits produce texto válido', () => {
  assert.equal(renderActivity([event()]), '- Actualicé código en [CamilaMarin/sky](https://github.com/CamilaMarin/sky).');
});
test('excluye eventos privados, de otros usuarios y del perfil automático', () => {
  assert.equal(renderActivity([event(undefined,{public:false}),event(undefined,{actor:{login:'bot'}}),event('CamilaMarin/camilamarin')]),'No hay actividad pública reciente para mostrar.');
});
test('agrupa repeticiones y limita a cinco entradas', () => {
  const text=renderActivity([event(),event(),...Array.from({length:8},(_,i)=>event(`CamilaMarin/repo${i}`))]);
  assert.equal(text.split('\n').length,5); assert.equal(text.match(/\/sky\)/g).length,1);
});
test('distingue pull request integrada y descarta nombres no válidos', () => {
  const text=renderActivity([event('x/](bad)'),event(undefined,{type:'PullRequestEvent',payload:{action:'closed',pull_request:{merged:true}}})]);
  assert.match(text,/Integré una pull request/); assert.doesNotMatch(text,/bad/);
});
test('reemplaza solo la actividad y rechaza marcadores ambiguos', () => {
  const source='Antes\n<!--RECENT_ACTIVITY:start-->\nviejo\n<!--RECENT_ACTIVITY:end-->\nDespués';
  assert.equal(replaceActivity(source,'nuevo'),source.replace('viejo','nuevo'));
  assert.throws(()=>replaceActivity('sin marcadores','nuevo'));
  assert.throws(()=>replaceActivity(source+'<!--RECENT_ACTIVITY:start-->','nuevo'));
});
test('errores HTTP y respuestas inválidas no se convierten en actividad vacía', async () => {
  await assert.rejects(fetchPublicEvents('CamilaMarin',null,async()=>({ok:false,status:503})),/503/);
  await assert.rejects(fetchPublicEvents('CamilaMarin',null,async()=>({ok:true,json:async()=>({error:true})})),/Formato/);
});
