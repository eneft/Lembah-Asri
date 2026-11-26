import test from 'node:test';
import assert from 'node:assert/strict';
import {newChapter, readChapter, visit, workBed, chapterPlots} from '../src/world/homeChapter.ts';

test('dry nights pause growth and the first delivery pays once across reload', () => {
  let s=newChapter(24);
  assert.equal(workBed(s,0,'hoe'), false);
  assert.ok(visit(s,'kit'));
  assert.equal(visit(s,'kit'),false);
  assert.ok(visit(s,'refill'));
  for (const action of ['hoe','sow','water']) assert.ok(workBed(s,0,action));
  assert.equal(workBed(s,0,'water'),false);
  visit(s,'sleep'); visit(s,'sleep');
  assert.equal(chapterPlots(s)[0].chapterStage,'sprout');
  assert.ok(workBed(s,0,'water')); visit(s,'sleep');
  assert.ok(workBed(s,0,'harvest')); assert.equal(workBed(s,0,'harvest'),false);
  s=readChapter(JSON.stringify(s),24);
  assert.ok(visit(s,'deliver')); assert.equal(visit(s,'deliver'),false);
  assert.equal(s.seeds,7); assert.equal(s.water,2);
  assert.equal(s.beds[1].tilled,false);
});
