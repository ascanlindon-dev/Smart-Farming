import assert from 'node:assert/strict';
import test from 'node:test';
import { maturityAdvice, maturityReadiness } from './maturityAdvice.mjs';

test('rejected and uncertain photos never receive harvesting advice', () => {
  for (const label of ['not_rambutan', 'unknown', '', null, 'apple']) {
    assert.equal(maturityAdvice(label), null);
    assert.equal(maturityReadiness(label), null);
  }
});

test('numeric labels follow the model class order without guessing', () => {
  assert.equal(maturityReadiness('0', ['mature', 'immature']), 'mature');
  assert.equal(maturityReadiness('class_0', ['immature', 'mature']), 'immature');
  assert.equal(maturityReadiness('0'), null);
  assert.equal(maturityReadiness('class_5', ['mature', 'immature']), null);
});

test('farmers get short actions in their selected language', () => {
  assert.match(maturityAdvice('immature', 'tl').description, /Huwag munang anihin/);
  assert.match(maturityAdvice('immature', 'en').description, /Leave it on the tree/);
  assert.match(maturityAdvice('mature', 'tl').harvestingTips.join(' '), /malinis na gunting/);
  assert.equal(maturityAdvice('immature').storageAdvice.length, 0);
  for (const language of ['en', 'tl']) {
    for (const stage of ['mature', 'immature']) {
      const advice = maturityAdvice(stage, language);
      assert.equal(advice.daysToHarvest, undefined);
      assert.equal(advice.qualityGrade, undefined);
      assert.equal(advice.harvestingTips.length, 3);
    }
  }
});
