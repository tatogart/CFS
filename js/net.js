// Сеть: WebRTC через PeerJS. Хост считает игру, клиенты шлют ввод и получают снимки.
// Сервер PeerJS нужен только чтобы найти друг друга по коду; дальше данные идут напрямую
// (в одной локальной сети — напрямую внутри сети).
const PEER_URL = new URL('../vendor/peerjs.min.js', import.meta.url).href;
const PREFIX = 'cfs-strike-room-';

let loading = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = PEER_URL; s.async = true;
    s.onload = () => res(); s.onerror = () => { loading = null; rej(new Error('Не удалось загрузить сетевой модуль')); };
    document.head.appendChild(s);
  });
  return loading;
}
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
const errText = e => {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Комната не найдена';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Нет связи с сервером комнат — проверьте интернет';
  if (t === 'browser-incompatible') return 'Браузер не поддерживает WebRTC';
  if (t === 'unavailable-id') return 'unavailable-id';
  return (e && e.message) || 'Ошибка сети';
};
const ICE = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };

export class Net {
  constructor() { this.role = null; this.conns = new Map(); this.h = {}; this.nextNid = 1; }
  on(t, fn) { this.h[t] = fn; return this; }
  emit(t, ...a) { if (this.h[t]) this.h[t](...a); }

  // создать комнату
  async host() {
    await loadPeer();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = newCode();
      try { await this._open(PREFIX + code); this.code = code; break; }
      catch (e) { if (!/unavailable|taken/i.test(String(e && (e.type || e.message)))) throw e; }
    }
    if (!this.code) throw new Error('Не удалось создать комнату');
    this.role = 'host'; this.myNid = 0;
    this.peer.on('connection', conn => {
      conn.on('open', () => {
        const nid = this.nextNid++; conn.nid = nid; this.conns.set(nid, conn);
        conn.on('data', d => this.emit('msg', nid, d));
        conn.on('close', () => { this.conns.delete(nid); this.emit('leave', nid); });
        conn.on('error', () => { this.conns.delete(nid); this.emit('leave', nid); });
        this.emit('join', nid);
      });
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { /* уже закрыт */ } });
    return this.code;
  }
  // подключиться к комнате
  async join(code) {
    await loadPeer();
    await this._open(undefined);
    this.role = 'client';
    code = String(code).trim().toUpperCase();
    return new Promise((res, rej) => {
      const conn = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const to = setTimeout(() => rej(new Error('Комната не найдена или хост недоступен')), 12000);
      conn.on('open', () => { clearTimeout(to); this.conn = conn; res(); });
      conn.on('data', d => this.emit('msg', 0, d));
      conn.on('close', () => this.emit('closed'));
      conn.on('error', e => { clearTimeout(to); rej(e); });
      this.peer.on('error', e => { clearTimeout(to); rej(new Error(errText(e))); });
    });
  }
  _open(id) {
    return new Promise((res, rej) => {
      const p = id ? new window.Peer(id, ICE) : new window.Peer(ICE);
      const to = setTimeout(() => rej(new Error('Нет связи с сервером комнат')), 12000);
      p.on('open', () => { clearTimeout(to); this.peer = p; res(); });
      p.on('error', e => { clearTimeout(to); if (!this.peer) { try { p.destroy(); } catch (x) { /* */ } const er = new Error(errText(e)); er.type = e && e.type; rej(er); } else this.emit('error', e); });
    });
  }
  send(nid, m) { const c = this.conns.get(nid); if (c && c.open) try { c.send(m); } catch (e) { /* канал закрыт */ } }
  broadcast(m) { for (const c of this.conns.values()) if (c.open) try { c.send(m); } catch (e) { /* */ } }
  toHost(m) { if (this.conn && this.conn.open) try { this.conn.send(m); } catch (e) { /* */ } }
  close() { try { this.peer && this.peer.destroy(); } catch (e) { /* */ } this.conns.clear(); this.conn = null; this.peer = null; this.role = null; this.code = null; }
}
