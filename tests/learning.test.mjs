import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons, gradeQuestion, gradeLesson, publicLesson, isUnlocked } from '../src/lessons.mjs';

test('lesson IDs and question IDs are unique', () => {
  assert.equal(new Set(lessons.map(l => l.id)).size, lessons.length);
  for (const l of lessons) assert.equal(new Set(l.questions.map(q => q.id)).size, l.questions.length);
});
test('no answer or explanation leaks through the lesson API', () => {
  const payload = JSON.stringify(lessons.map(publicLesson));
  assert.ok(!payload.includes('"answer"'));
  assert.ok(!payload.includes('"accepted"'));
  assert.ok(!payload.includes('"explanation"'));
});
test('correct choices are recognized', () => {
  assert.equal(gradeQuestion(lessons[0].questions[0], 'Hello').correct, true);
  assert.equal(gradeQuestion(lessons[0].questions[0], 'Goodbye').correct, false);
});
test('Spanish text ignores casing and extra spaces', () => {
  assert.equal(gradeQuestion(lessons[0].questions[2], '  BUENOS   DÍAS ').correct, true);
});
test('accent differences are not silently treated as correct', () => {
  assert.equal(gradeQuestion(lessons[0].questions[2], 'buenos dias').correct, false);
});
test('missing answers do not earn points', () => {
  assert.equal(gradeLesson(lessons[0], {}).percent, 0);
});
test('four out of five answers passes at 80 percent', () => {
  const l=lessons[0]; const answers=Object.fromEntries(l.questions.slice(0,4).map(q => [q.id,q.answer]));
  const r=gradeLesson(l,answers); assert.equal(r.percent,80); assert.equal(r.passed,true);
});
test('lower scores do not unlock subsequent lessons', () => {
  assert.equal(isUnlocked('greetings', []), true);
  assert.equal(isUnlocked('introductions', [{lesson_id:'greetings',best_percent:79}]),false);
  assert.equal(isUnlocked('introductions', [{lesson_id:'greetings',best_percent:80}]),true);
  assert.equal(isUnlocked('not-real', []),false);
});

test('all choice questions have the answer among options', () => {
  for (const lesson of lessons) for (const q of lesson.questions) {
    if (q.kind === 'choice' || q.kind === 'listen') assert.ok(q.options.includes(q.answer), `${q.id} has an answer not in the options`);
  }
});
test('all lessons have useful explanations and learning objectives', () => {
  for (const lesson of lessons) {
    assert.ok(lesson.goal.length >= 15);
    for (const q of lesson.questions) assert.ok(q.explanation.length >= 20, q.id);
  }
});
