import test from 'node:test';
import assert from 'node:assert/strict';
import {wallTime,dateTime,plotDate,withGaps} from '../docs/charts.mjs';
test('Shanghai chart timestamps do not depend on browser timezone',()=>{
 assert.equal(plotDate(wallTime('2026-10-25T00:25:00Z')),'2026-10-25T08:25:00.000');
 assert.equal(plotDate(dateTime('2026-10-25')),'2026-10-25T00:00:00.000');
});
test('missing heart samples break the curve instead of interpolation',()=>{
 const result=withGaps([[0,70,70,70,1],[60000,75,75,75,1],[3600000,80,80,80,1]]);
 assert.equal(result.length,4);assert.equal(result[2][1],null);assert.equal(result[3][1],80);
});
