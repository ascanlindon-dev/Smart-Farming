import assert from 'node:assert/strict';
import test from 'node:test';
import { leafScanNotice, leafPreviewCard } from './leafScanResponse.mjs';

test('a high disease score never overrides a rejected leaf check', () => {
  const notice = leafScanNotice({ type: 'leaf', label: 'Healthy Leaf', confidence: 0.999, leaf_verified: false });
  assert.equal(notice.kind, 'not_leaf');
});

test('legacy non-leaf responses are still rejected', () => {
  assert.equal(leafScanNotice({ type: 'not_leaf', label: 'not_leaf' }).kind, 'not_leaf');
});

test('missing verification never allows diagnosis or treatment', () => {
  for (const data of [null, {}, { type: 'leaf', label: 'Anthracnose' }]) {
    assert.equal(leafScanNotice(data).kind, 'unverified');
  }
});

test('verified leaves with an uncertain disease request a retake', () => {
  assert.equal(leafScanNotice({ type: 'leaf', label: 'unknown', leaf_verified: true }).kind, 'uncertain');
});

test('only verified leaves with a disease result may display a diagnosis', () => {
  assert.equal(leafScanNotice({ type: 'leaf', label: 'Healthy Leaf', leaf_verified: true }), null);
  assert.equal(leafScanNotice({ type: 'leaf', label: 'Anthracnose', leaf_verified: true }), null);
});

test('rejection message is understandable in Tagalog', () => {
  const notice = leafScanNotice({ type: 'not_leaf', leaf_verified: false }, 'tl');
  assert.equal(notice.title, 'Dahon lamang');
  assert.match(notice.message, /Ilapit ang isang dahon/);
});

test('an unverified uploaded photo never replaces disease example images', () => {
  const item = { disease: 'Anthracnose', image: 'example-leaf.jpg', confidence: 89.2 };
  const card = leafPreviewCard(item, false, 'uploaded-apple.jpg');
  assert.equal(card.image, 'example-leaf.jpg');
  assert.equal(card.confidence, null);
});

test('a verified result card uses the scanned leaf and measured confidence', () => {
  const card = leafPreviewCard({ image: 'example-leaf.jpg', confidence: '96.4' }, true, 'uploaded-leaf.jpg');
  assert.equal(card.image, 'uploaded-leaf.jpg');
  assert.equal(card.confidence, '96.4');
});
