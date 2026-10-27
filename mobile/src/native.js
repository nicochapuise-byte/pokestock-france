import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { CapacitorNeon } from '@capgo/capacitor-neon';
import { createNativeAuthClient } from './auth-adapter.mjs';
import { createApiFetch } from './api-transport.mjs';
import { receiveCameraRestore } from './proof-camera.js';
import { externalDestination, backDestination } from './navigation.mjs';
export async function initializeNative() {
  if (!Capacitor.isNativePlatform()) throw Error('Native application required');
  const config=__MOBILE_CONFIG__;
  App.addListener('appRestoredResult',receiveCameraRestore);
  const webFetch=window.fetch.bind(window);
  window.fetch=createApiFetch(config.apiUrl,options=>CapacitorHttp.request(options),webFetch);
  const authReady=CapacitorNeon.initialize({authUrl:config.authUrl});
  authReady.catch(()=>{});
  document.documentElement.classList.add('native-app');
  window.pokestockNative = {
    createAuthClient:()=>createNativeAuthClient(CapacitorNeon,authReady),
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
  if(config.name!=='production'){
    const label=document.createElement('p');label.className='native-test-build';
    label.textContent='Version de test — données de développement';document.body.prepend(label);
  }
  const updateNetwork = ({ connected }) => { banner.hidden=connected; };
  Network.getStatus().then(updateNetwork).catch(() => {});
  Network.addListener('networkStatusChange', updateNetwork);
  App.addListener('appStateChange',({isActive})=>{if(isActive)document.dispatchEvent(new Event('pokestock:nativeresume'));});
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
