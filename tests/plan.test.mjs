import test from 'node:test';
import assert from 'node:assert/strict';
import {completion,taskFor} from '../docs/plan.mjs';
test('sleep and training complete independently',()=>{
 assert.deepEqual(completion('2026-10-27',{sleepMinutes:450,beforeMidnight:true},'2026-10-28'),{sleep:'complete',exercise:'unknown'});
 assert.deepEqual(completion('2026-10-27',{sleepMinutes:350,beforeMidnight:true,runMinutes:20},'2026-10-28'),{sleep:'partial',exercise:'complete'});
});
test('Friday needs both run and strength, not either',()=>{
 assert.equal(completion('2026-10-30',{runMinutes:20},'2026-10-31').exercise,'partial');
 assert.equal(completion('2026-10-30',{runMinutes:15,strengthMinutes:15},'2026-10-31').exercise,'complete');
});
test('late sleep, missing data and future dates never become completed',()=>{
 assert.equal(completion('2026-10-27',{sleepMinutes:480,beforeMidnight:false},'2026-10-28').sleep,'partial');
 assert.equal(completion('2026-10-27',undefined,'2026-10-28').sleep,'unknown');
 assert.equal(completion('2026-10-27',{sleepMinutes:480,beforeMidnight:true,runMinutes:25},'2026-10-25').exercise,'future');
});
test('rest days and dates outside plan do not manufacture completion',()=>{
 assert.equal(completion('2026-10-31',{},'2026-11-01').exercise,'rest');
 assert.equal(taskFor('2026-10-25'),null);assert.equal(taskFor('2027-01-26'),null);
});
