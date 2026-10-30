import test from 'node:test';
import assert from 'node:assert/strict';
import {taskStreak,taskInput,initialState,toggleCompletion} from '../public/domain.js';
test('task streaks retain yesterday until today is logged and count each day once',()=>{
 const task={history:{'2024-02-28':[{}],'2024-02-29':[{},{}]}};
 assert.deepEqual(taskStreak(task,'2024-03-01'),{current:2,active:false});
 task.history['2024-03-01']=[{}];assert.deepEqual(taskStreak(task,'2024-03-01'),{current:3,active:true});
 assert.deepEqual(taskStreak(task,'2024-03-03'),{current:0,active:false});
 assert.deepEqual(taskStreak({history:{}},'2024-03-01'),{current:0,active:false});
});
test('undo and partial habit completions update streaks without counting focus or future entries',()=>{
 const state=initialState(),task=taskInput({title:'German',repeat:'interval_0.5'});state.tasks.push(task);
 task.history={'2026-10-29':[{id:'yesterday',coins:0}], '2026-11-01':[{id:'future',coins:0}]};
 toggleCompletion(state,task.id,'2026-10-30');assert.deepEqual(taskStreak(task,'2026-10-30'),{current:2,active:true});
 toggleCompletion(state,task.id,'2026-10-30');assert.equal(taskStreak(task,'2026-10-30').current,2);
 toggleCompletion(state,task.id,'2026-10-30');assert.equal(taskStreak(task,'2026-10-30').active,true);
 toggleCompletion(state,task.id,'2026-10-30');assert.equal(task.history['2026-10-30'].length,2);
 task.history['2026-10-30']=[];assert.deepEqual(taskStreak(task,'2026-10-30'),{current:1,active:false});
});
