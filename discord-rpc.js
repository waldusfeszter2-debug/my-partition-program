/* ==========================================================================
   NEXUS 1.1.1 – discord-rpc.js
   Integracja Discord Rich Presence – wykrywa gry po tytule strony / URL.
   ========================================================================== */
const DiscordRPC = require('discord-rpc');

/* ⚠️ ZMIEŃ NA SWÓJ CLIENT ID Z https://discord.com/developers/applications */
const CLIENT_ID = '1551198599679967232';   // ← WSTAW SWÓJ CLIENT ID

/* Lista gier – dopasowanie po tytule strony lub URL (case-insensitive). */
const GAME_DETECTORS = [
  { name: 'Hero Wars',            match: ['hero wars', 'herowars'] },
  { name: 'Lets Fish',            match: ['lets fish', 'letsfish'] },
  { name: 'Cookie Clicker',       match: ['cookie clicker'] },
  { name: 'Slither.io',           match: ['slither.io'] },
  { name: 'Agar.io',              match: ['agar.io'] },
  { name: 'Diep.io',              match: ['diep.io'] },
  { name: 'Krunker',              match: ['krunker'] },
  { name: 'Shell Shockers',       match: ['shell shockers'] },
  { name: 'Zombs Royale',         match: ['zombs royale'] },
  { name: 'Realm of the Mad God', match: ['realm of the mad god', 'rotmg'] },
];

let rpc = null;
let ready = false;
let startTimestamp = null;
let currentGame = null;
let reconnectTimer = null;

/* ---------- INICJALIZACJA ---------- */
function init() {
  if (rpc) return;
  rpc = new DiscordRPC.Client({ transport: 'ipc' });

  rpc.on('ready', () => {
    ready = true;
    console.log('[RPC] Discord RPC ready');
    if (currentGame) setGame(currentGame);
  });

  rpc.on('disconnected', () => {
    ready = false;
    console.warn('[RPC] Discord RPC disconnected');
    scheduleReconnect();
  });

  rpc.login({ clientId: CLIENT_ID }).catch(err => {
    console.warn('[RPC] Login failed:', err.message);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!ready) {
      rpc = null;
      init();
    }
  }, 15000);
}

/* ---------- DETEKCJA GRY ---------- */
function detectGame(title, url) {
  const haystack = `${title || ''} ${url || ''}`.toLowerCase();
  for (const g of GAME_DETECTORS) {
    if (g.match.some(m => haystack.includes(m))) return g.name;
  }
  return null;
}

/* ---------- USTAWIANIE AKTYWNOŚCI ---------- */
function setGame(gameName) {
  if (!ready || !rpc) return;
  if (currentGame === gameName) return;

  currentGame = gameName;
  startTimestamp = new Date();

  const activity = gameName
    ? {
        details: `Gra w ${gameName}`,
        state: 'W grze',
        startTimestamp,
        largeImageKey: 'nexus_logo',
        largeImageText: 'NEXUS Browser',
        instance: false,
      }
    : {
        details: 'Przegląda internet',
        state: 'NEXUS',
        startTimestamp,
        largeImageKey: 'nexus_logo',
        largeImageText: 'NEXUS Browser',
        instance: false,
      };

  rpc.setActivity(activity).catch(err => {
    console.warn('[RPC] setActivity failed:', err.message);
  });
}

function clearGame() {
  currentGame = null;
  if (ready && rpc) {
    rpc.clearActivity().catch(() => {});
  }
}

/* ---------- API ---------- */
module.exports = {
  init,
  setGame,
  clearGame,
  detectGame,
};