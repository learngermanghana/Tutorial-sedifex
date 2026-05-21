export const GOOGLE_MERCHANT_BLOCKED_CATEGORY_KEYWORDS = [
  'supplement',
  'medicine',
  'medication',
  'pharmacy',
  'pharmaceutical',
  'prescription',
  'otc',
  'vitamin',
  'health supplement',
  'wellness supplement',
];

export const GOOGLE_MERCHANT_BLOCKED_TEXT_KEYWORDS = [
  'supplement',
  'medicine',
  'medication',
  'pharmacy',
  'pharmaceutical',
  'prescription',
  'vitamin',
  'detox',
  'slimming',
  'weight loss',
  'flat tummy',
  'hormone',
  'tablet',
  'capsule',
  'pill',
  'injection',
  'iv drip',
  'glutathione',
  'skin whitening',
  'whitening skin',
  'dark knuckle',
  'breast enlargement',
  'hip booster',
  'body curve',
  'collagen drink',
  'pimples',
  'anti pimples',
  'stretch mark removal',
];

export type GoogleMerchantReviewable = Record<string, unknown>;

export function policyText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\*\*/g, '')
    .replace(/^[-–—:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function merchantBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'approved', 'allowed', 'include', 'visible', 'published', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'blocked', 'excluded', 'exclude', 'hidden', 'draft', 'inactive'].includes(normalized)) return false;
  }
  return null;
}

export function containsMerchantPolicyKeyword(text: string, keywords: string[]): boolean {
  if (!text) return false;
  const padded = ` ${text} `;
  return keywords.some((keyword) => padded.includes(` ${policyText(keyword)} `));
}

export function googleMerchantRiskReasons(item: GoogleMerchantReviewable): string[] {
  const categoryText = policyText([item.categoryKey, item.categoryName, item.category, item.categoryId].filter(Boolean).join(' '));
  const itemText = policyText([
    item.productName,
    item.serviceName,
    item.courseName,
    item.name,
    item.title,
    item.description,
    item.summary,
    item.shortDescription,
    item.categoryKey,
    item.categoryName,
    item.category,
    item.manufacturerName,
    item.tags,
  ].filter(Boolean).join(' '));

  const reasons: string[] = [];
  if (containsMerchantPolicyKeyword(categoryText, GOOGLE_MERCHANT_BLOCKED_CATEGORY_KEYWORDS)) reasons.push('Restricted category');
  if (containsMerchantPolicyKeyword(itemText, GOOGLE_MERCHANT_BLOCKED_TEXT_KEYWORDS)) reasons.push('Restricted health/claim text');
  return Array.from(new Set(reasons));
}

export function isExplicitlyExcludedFromGoogleMerchant(item: GoogleMerchantReviewable): boolean {
  return [
    item.excludeFromGoogleMerchant,
    item.googleMerchantExcluded,
    item.googleShoppingExcluded,
    item.merchantCenterExcluded,
    item.restrictedProduct,
    item.regulatedProduct,
    item.healthProduct,
    item.medicalProduct,
    item.pharmaceuticalProduct,
    item.pharmacyProduct,
    item.supplementProduct,
    item.requiresPrescription,
    item.ageRestricted,
  ].some((value) => merchantBoolean(value) === true) || merchantBoolean(item.googleMerchantEligible) === false;
}

export function isAllowedForGoogleMerchant(item: GoogleMerchantReviewable): boolean {
  if (isExplicitlyExcludedFromGoogleMerchant(item)) return false;
  if (googleMerchantRiskReasons(item).length > 0) return false;
  return true;
}
