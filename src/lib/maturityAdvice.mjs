// Simple harvest guidance, not measurements inferred from a photo.
// Sources: https://www.fao.org/4/ad523e/ad523e04.htm
// https://www.ctahr.hawaii.edu/oc/freepubs/pdf/F_N-33.pdf
export const FARM_HARVEST_REFERENCE = {
  harvestSeason: 'September–October',
  floweringPeriod: 'July',
  reportedCycleMonths: 8,
};

export function maturityAdvice(readiness, language = 'en') {
  const tl = language === 'tl';
  if (readiness === 'immature') return {
    readiness,
    stage: tl ? 'Hindi pa hinog' : 'Unripe',
    description: tl
      ? 'Hindi pa hinog ang nasuring bunga. Patuloy itong subaybayan at huwag munang anihin.'
      : 'The photographed fruit is classified as unripe. Continue monitoring it on the tree.',
    action: tl ? 'Patuloy na subaybayan' : 'Continue monitoring',
    harvestingTips: tl
      ? ['Patuloy na subaybayan ang bungang ito.', 'Iwan muna ito sa puno.', 'Tingnan muli kung nagbago ang kulay.']
      : ['Continue monitoring this fruit.', 'Leave it on the tree for now.', 'Check again for a change in color.'],
    storageAdvice: [],
  };
  if (readiness === 'mature') return {
    readiness,
    stage: tl ? 'Hinog' : 'Ripe',
    description: tl
      ? 'Hinog ang nasuring bunga. Suriin muna ito bago anihin; ang resulta ay para lamang sa bungang nasa larawan.'
      : 'The photographed fruit is classified as ripe. Inspect the fruit for harvesting; this result applies only to the pictured fruit.',
    action: tl ? 'Suriin bago anihin' : 'Inspect for harvesting',
    harvestingTips: tl
      ? ['Suriin ang bunga kung maaari na itong anihin.', 'Tiyaking ang kulay ay tama para sa iyong uri ng rambutan.', 'Gupitin ang tangkay gamit ang malinis na gunting.']
      : ['Inspect the fruit for harvesting.', 'Check that its color is right for your rambutan variety.', 'Cut the stem with clean clippers.'],
    storageAdvice: tl
      ? ['Ilagay sa lilim at malamig na lugar.', 'Huwag patungan ng mabibigat na bagay.', 'Ihiwalay ang mga bulok o sirang bunga.']
      : ['Keep the fruit in a cool, shaded place.', 'Keep heavy items off the fruit.', 'Separate rotten or damaged fruit.'],
  };
  return null;
}

export function maturityReadiness(label, classNames = []) {
  let value = String(label ?? '').trim().toLowerCase();
  const index = value.match(/^(?:class_)?(\d+)$/);
  if (index) value = String(classNames[Number(index[1])] ?? '').trim().toLowerCase();
  if (['mature', 'ripe', 'overripe'].includes(value)) return 'mature';
  if (['immature', 'unripe'].includes(value)) return 'immature';
  return null;
}
