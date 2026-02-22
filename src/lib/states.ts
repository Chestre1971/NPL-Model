/**
 * US state judicial vs. non-judicial foreclosure classification.
 *
 * Deed of Trust states use non-judicial (power-of-sale) foreclosure.
 * Mortgage states require judicial foreclosure.
 * States that allow both are treated as judicial (conservative assumption).
 *
 * Source: standard US foreclosure law classification.
 */

/** States that use Deeds of Trust → non-judicial foreclosure. */
const NON_JUDICIAL_STATES = new Set([
  'Alaska',
  'California',
  'Colorado',
  'District of Columbia',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Maine',
  'Massachusetts',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Mexico',
  'North Carolina',
  'Oregon',
  'Rhode Island',
  'Tennessee',
  'Texas',
  'Utah',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wyoming',
]);

/**
 * Returns true if the state requires judicial foreclosure.
 * States that allow both are treated as judicial (conservative).
 */
export function isJudicialState(jurisdiction: string): boolean {
  return !NON_JUDICIAL_STATES.has(jurisdiction);
}
