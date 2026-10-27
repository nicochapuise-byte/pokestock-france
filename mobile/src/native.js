import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { externalDestination, backDestination } from './navigation.mjs';
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app');
  window.pokestockNative = {
    getCurrentPosition(success, failure) {
      // Explicit user action only, no watch/background GPS.
      Geolocation.getCurrentPosition({ enableHighAccuracy:false, timeout:15000, maximumAge:60000 }).then(success).catch(failure);
    }
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || link.hasAttribute('download')) return;
    const url = externalDestination(link.getAttribute('href'), location.href);
    if (!url) return;
    event.preventDefault();
    Browser.open({ url, toolbarColor:'#0b162c' }).catch(() => window.alert('Impossible d’ouvrir ce lien pour le moment.'));
  });
  const banner = document.createElement('div'); banner.className='native-network-status'; banner.setAttribute('role','status'); banner.hidden=true;
  banner.textContent='Hors connexion : les disponibilités et la connexion au compte nécessitent Internet.';
  document.body.prepend(banner);
  const updateNetwork = ({ connected }) => { banner.hidden=connected; };
  Network.getStatus().then(updateNetwork).catch(() => {});
  Network.addListener('networkStatusChange', updateNetwork);
  App.addListener('backButton', () => {
    const modal=[...document.querySelectorAll('.modal.open')].at(-1);
    const close=modal?.querySelector('.modal-close, [data-close-modal], [data-close-auth], [data-close-watches], [data-close-my-reports], [data-close-admin]');
    if (close) { close.click(); return; }
    if (document.querySelector('.modal.open')) return;
    const next=backDestination(location.pathname,location.hash);
    if (next==='index.html') location.href='index.html';
    else if (next) location.hash=next;
    else App.minimizeApp();
  });
}
