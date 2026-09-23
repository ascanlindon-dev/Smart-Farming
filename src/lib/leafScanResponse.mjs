// No diagnosis or treatment may be displayed without a successful leaf check.
export function leafScanNotice(data, language = 'en') {
  const tl = language === 'tl';
  if (data?.type === 'not_leaf' || data?.label === 'not_leaf' || data?.leaf_verified === false) {
    return {
      kind: 'not_leaf',
      title: tl ? 'Dahon lamang' : 'Leaves only',
      message: tl
        ? 'Hindi matiyak na dahon ang nasa larawan. Ilapit ang isang dahon at ipakita ang buong gilid nito.'
        : 'A leaf was not confirmed. Take a close-up of one leaf with its edges visible.',
    };
  }
  if (data?.leaf_verified !== true || data?.type !== 'leaf') {
    return {
      kind: 'unverified',
      title: tl ? 'Hindi nasuri ang dahon' : 'Leaf check incomplete',
      message: tl ? 'Hindi matiyak ang larawan. Subukan ulit.' : 'The photo could not be verified. Please try again.',
    };
  }
  if (!data.label || data.label === 'unknown') {
    return {
      kind: 'uncertain',
      title: tl ? 'Hindi matiyak ang sakit' : 'Disease is unclear',
      message: tl
        ? 'Kunan ulit nang malinaw ang dahon sa maliwanag na lugar.'
        : 'Take another clear photo of the leaf in good light.',
    };
  }
  return null;
}

// Example cards must never relabel the user's unverified or rejected photo.
export function leafPreviewCard(item, hasVerifiedResult, selectedImage) {
  return {
    ...item,
    image: hasVerifiedResult ? selectedImage || item.image : item.image,
    confidence: hasVerifiedResult ? item.confidence : null,
  };
}
