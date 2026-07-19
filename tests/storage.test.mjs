import test from 'node:test'; import assert from 'node:assert/strict'; import { savePlayerSession, loadPlayerSession, clearPlayerSession } from '../js/storage.js';
globalThis.localStorage = { data:{}, setItem(k,v){this.data[k]=v}, getItem(k){return this.data[k]||null}, removeItem(k){delete this.data[k]} };
test('session persistence is room scoped',()=>{ savePlayerSession('ab',{resumeToken:'secret',name:'A'}); assert.deepEqual(loadPlayerSession('AB'),{resumeToken:'secret',name:'A'}); clearPlayerSession('ab'); assert.equal(loadPlayerSession('ab'),null); });
