/** Builds public asset URLs that work locally and under a GitHub Pages subpath. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
