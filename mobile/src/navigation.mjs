export function externalDestination(href, base) {
  let url; try { url=new URL(href,base); } catch { return null; }
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password) return null;
  if (url.origin===new URL(base).origin) return null;
  return url.href;
}
export function backDestination(pathname,hash) {
  if (!pathname.endsWith('/index.html') && pathname!=='/') return 'index.html';
  return hash && hash!=='#accueil' ? '#accueil' : null;
}
