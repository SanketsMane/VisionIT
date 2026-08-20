import slugify from 'slugify';

export const toSlug = (value: string): string =>
  slugify(value, { lower: true, strict: true, trim: true, remove: /[*+~.()'"!:@]/g });

/**
 * Appends `-2`, `-3`, … until the slug is free. `exists` is injected so this
 * stays pure and testable while each module supplies its own uniqueness scope
 * (e.g. unique per user, not globally).
 */
export const uniqueSlug = async (
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> => {
  const root = toSlug(base) || 'item';
  let candidate = root;
  let counter = 2;
  // Bounded so a pathological `exists` can never spin forever.
  while (counter < 500 && (await exists(candidate))) {
    candidate = `${root}-${counter}`;
    counter += 1;
  }
  return candidate;
};
