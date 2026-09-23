// Simple harvest guidance, not measurements inferred from a photo.
// Sources: https://www.fao.org/4/ad523e/ad523e04.htm
// https://www.ctahr.hawaii.edu/oc/freepubs/pdf/F_N-33.pdf
export function maturityAdvice(readiness, language = 'en') {
  const tl = language === 'tl';
  if (readiness === 'immature') return {
    readiness,
    stage: tl ? 'Hindi pa hinog' : 'Not yet ripe',
    description: tl ? 'Mukhang hindi pa hinog ang rambutan. Huwag munang anihin.' : 'The rambutan looks unripe. Leave it on the tree for now.',
    action: tl ? 'Maghintay muna' : 'Wait before picking',
    harvestingTips: tl
      ? ['Iwan muna sa puno ang bunga.', 'Tingnan ulit bukas kung nagbago ang kulay.', 'Hintaying maging hinog ang kulay na karaniwan sa iyong uri ng rambutan.']
      : ['Leave the fruit on the tree.', 'Check its color again tomorrow.', 'Wait for the usual ripe color of your rambutan variety.'],
    storageAdvice: [],
  };
  if (readiness === 'mature') return {
    readiness,
    stage: tl ? 'Mukhang hinog na' : 'Looks ripe',
    description: tl ? 'Mukhang hinog na ang rambutan. Tingnan muna ang bunga bago anihin.' : 'The rambutan looks ripe. Check the fruit before picking.',
    action: tl ? 'Suriin bago anihin' : 'Check before picking',
    harvestingTips: tl
      ? ['Tiyaking hinog ang kulay para sa iyong uri ng rambutan.', 'Gupitin ang tangkay gamit ang malinis na gunting.', 'Dahan-dahang ilagay sa malinis na lalagyan. Huwag ihagis.']
      : ['Check that the color is right for your rambutan variety.', 'Cut the stem with clean clippers.', 'Place the fruit gently in a clean container. Do not throw it.'],
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
