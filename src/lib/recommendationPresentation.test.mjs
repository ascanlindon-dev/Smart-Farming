import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendationPresentation } from './recommendationPresentation.mjs';

test('the disease endpoint openai source is recognized as generated text', () => {
  assert.equal(recommendationPresentation('Generated assessment.', 'openai', 'en').isAi, true);
});

test('the panel displays the actual AI response instead of a built-in paragraph', () => {
  const response = 'Sample generated advice for this specific scan.';
  const panel = recommendationPresentation(response, 'ai', 'en', 'Old static advice.');
  assert.equal(panel.text, response);
  assert.equal(panel.isAi, true);
  assert.equal(panel.header, 'AI Recommendation');
  assert.match(panel.subtitle, /OpenAI/);
});

test('a backend fallback keeps its text and is not labeled AI-generated', () => {
  const panel = recommendationPresentation('Nakahandang payo.', 'fallback', 'tl');
  assert.equal(panel.text, 'Nakahandang payo.');
  assert.equal(panel.isAi, false);
  assert.equal(panel.header, 'Rekomendasyon');
  assert.match(panel.subtitle, /Nakahandang/);
});

test('empty API text uses local guidance without claiming AI generated it', () => {
  for (const summary of ['', '   ', null, undefined]) {
    const panel = recommendationPresentation(summary, 'ai', 'en', 'Local fallback.');
    assert.equal(panel.text, 'Local fallback.');
    assert.equal(panel.isAi, false);
    assert.equal(panel.insightLabel, 'Guidance:');
  }
});

test('unknown sources never claim OpenAI generated the recommendation', () => {
  const panel = recommendationPresentation('Some advice.', undefined, 'en');
  assert.equal(panel.isAi, false);
  assert.doesNotMatch(panel.subtitle, /OpenAI/);
});
