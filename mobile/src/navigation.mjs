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

// Android's system Back button should dismiss the map filter drawer before
// returning to the home screen. The drawer is not a .modal; its backdrop
// is the source of truth for whether it is currently open.
export function closeOpenFilters(doc) {
  const backdrop=doc.getElementById('filterBackdrop');
  const close=doc.getElementById('closeFilters');
  if(!backdrop||backdrop.hidden||!close)return false;
  close.click();
  return true;
}
