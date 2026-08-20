import { redirect } from 'next/navigation';

/**
 * Sign-up is closed, but the path is kept as a redirect rather than deleted:
 * old links, bookmarks and search results would otherwise land on a 404, and
 * the login page is where those people actually want to be.
 */
export default function RegisterPage() {
  redirect('/login');
}
