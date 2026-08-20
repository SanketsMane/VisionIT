import { redirect } from 'next/navigation';

/**
 * The portfolio manager moved to /projects/catalog, next to the client projects
 * it sits beside conceptually. Kept as a redirect so old bookmarks and any
 * link still pointing here land in the right place.
 */
export default function PortfolioManagerPage() {
  redirect('/projects/catalog');
}
