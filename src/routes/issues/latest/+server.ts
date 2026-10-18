import { redirect } from '@sveltejs/kit';

/**
 * /issues/latest: the old Hugo site's "Read Our Latest Issue" page, which
 * listed every issue newest first. That is what /issues is now, so old links
 * (and anything printed with this address) land there.
 */
export function GET() {
  redirect(308, '/issues');
}
