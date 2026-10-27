// Управление: клавиатура/мышь и сенсорный экран
export const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export class Controls {
  constructor(canvas, touchRoot) {
    this.canvas = canvas; this.touchRoot = touchRoot;
    this.keys = new Set();
    this.s = { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, jump: false, crouch: false, walk: false, use: false, score: false };
    this.edges = new Set();
    this.touch = isTouch();
    this.crouchToggle = false;
    this.enabled = false;
    this._bind();
  }
  edge(name) { if (this.edges.has(name)) { this.edges.delete(name); return true; } return false; }
  press(name) { this.edges.add(name); }
  takeLook() { const x = this.s.lookX, y = this.s.lookY; this.s.lookX = 0; this.s.lookY = 0; return [x, y]; }
  reset() { this.keys.clear(); Object.assign(this.s, { mx: 0, my: 0, fire: false, jump: false, use: false, score: false, walk: false }); this.edges.clear(); this.joyId = null; this.lookId = null; this.fireIds = new Set(); this._knob(0, 0); }
  lock() { if (!this.touch && this.canvas.requestPointerLock) { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* нет */ } } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  get locked() { return document.pointerLockElement === this.canvas; }

  _updMove() {
    if (this.joyActive) return;
    const k = this.keys;
    this.s.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    this.s.my = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    this.s.walk = k.has('ShiftLeft') || k.has('ShiftRight');
    this.s.crouch = k.has('ControlLeft') || k.has('KeyC') || this.crouchToggle;
    this.s.jump = k.has('Space');
    this.s.use = k.has('KeyE');
    this.s.score = k.has('Tab');
  }
  _bind() {
    const map = { KeyR: 'reload', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5', KeyQ: 'last', KeyB: 'buy', Escape: 'pause', KeyG: 'drop', KeyF: 'inspect', Space: 'jumpP' };
    addEventListener('keydown', e => {
      if (!this.enabled) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat && map[e.code]) this.press(map[e.code]);
      this.keys.add(e.code); this._updMove();
    });
    addEventListener('keyup', e => { this.keys.delete(e.code); this._updMove(); });
    addEventListener('blur', () => { this.keys.clear(); this._updMove(); this.s.fire = false; });
    this.canvas.addEventListener('mousedown', e => {
      if (!this.enabled || this.touch) return;
      if (!this.locked) { this.lock(); return; }
      if (e.button === 0) { this.s.fire = true; this.press('fireP'); }
      if (e.button === 2) this.press('aim');
    });
    addEventListener('mouseup', e => { if (e.button === 0) { this.s.fire = false; this.press('fireR'); } });
    addEventListener('contextmenu', e => { if (this.enabled) e.preventDefault(); });
    addEventListener('mousemove', e => { if (this.enabled && this.locked) { this.s.lookX += e.movementX; this.s.lookY += e.movementY; } });
    addEventListener('wheel', e => { if (this.enabled && this.locked) this.press(e.deltaY > 0 ? 'next' : 'prev'); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { if (this.enabled && !this.locked && !this.touch && !this.suppressPause) this.press('unlocked'); });

    // ---- сенсор ----
    const root = this.touchRoot; if (!root) return;
    this.fireIds = new Set();
    const joy = root.querySelector('#joy'), knob = root.querySelector('#knob');
    this._knob = (x, y) => { if (knob) knob.style.transform = `translate(${x}px, ${y}px)`; };
    const btnAct = el => { while (el && el !== root) { if (el.dataset && el.dataset.act) return el; el = el.parentElement; } return null; };
    root.addEventListener('touchstart', e => {
      if (!this.enabled) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        const b = btnAct(document.elementFromPoint(t.clientX, t.clientY) || t.target);
        if (b) {
          const a = b.dataset.act; b.classList.add('on');
          if (a === 'fire') { this.fireIds.add(t.identifier); this.s.fire = true; this.press('fireP'); this._lastLook = this._lastLook || {}; this._lastLook[t.identifier] = [t.clientX, t.clientY]; }
          else if (a === 'jump') { this.s.jump = true; this.press('jumpP'); this._hold = this._hold || {}; this._hold[t.identifier] = b; }
          else if (a === 'crouch') { this.crouchToggle = !this.crouchToggle; this.s.crouch = this.crouchToggle; b.classList.toggle('lit', this.crouchToggle); }
          else if (a === 'use') { this.s.use = true; this._hold = this._hold || {}; this._hold[t.identifier] = b; }
          else if (a === 'score') { this.s.score = !this.s.score; }
          else this.press(a);
          if (a !== 'fire' && a !== 'jump' && a !== 'use') setTimeout(() => b.classList.remove('on'), 120);
          continue;
        }
        if (t.clientX < innerWidth * 0.42 && this.joyId == null) {
          this.joyId = t.identifier; this.joyActive = true; this.joyO = [t.clientX, t.clientY];
          if (joy) { joy.style.left = (t.clientX - 60) + 'px'; joy.style.top = (t.clientY - 60) + 'px'; joy.classList.add('active'); }
        } else if (this.lookId == null) {
          this.lookId = t.identifier; this.lookP = [t.clientX, t.clientY]; this.lookStart = performance.now(); this.lookMoved = 0;
        }
      }
    }, { passive: false });
    root.addEventListener('touchmove', e => {
      if (!this.enabled) return;
      e.preventDefault();
      const ts = this.touchSens || 1;
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          let dx = t.clientX - this.joyO[0], dy = t.clientY - this.joyO[1]; const L = Math.hypot(dx, dy), R = 55;
          if (L > R) { dx *= R / L; dy *= R / L; }
          this._knob(dx, dy);
          const m = Math.min(1, L / R);
          this.s.mx = dx / R; this.s.my = -dy / R;
          this.s.walk = m < 0.55 && m > 0.1;
        } else if (t.identifier === this.lookId) {
          const dx = t.clientX - this.lookP[0], dy = t.clientY - this.lookP[1];
          this.s.lookX += dx * 2.2 * ts; this.s.lookY += dy * 2.2 * ts; this.lookP = [t.clientX, t.clientY]; this.lookMoved += Math.abs(dx) + Math.abs(dy);
        } else if (this.fireIds.has(t.identifier)) {
          const p = this._lastLook[t.identifier];
          this.s.lookX += (t.clientX - p[0]) * 2.2 * ts; this.s.lookY += (t.clientY - p[1]) * 2.2 * ts;
          this._lastLook[t.identifier] = [t.clientX, t.clientY];
        }
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) { this.joyId = null; this.joyActive = false; this.s.mx = this.s.my = 0; this.s.walk = false; this._knob(0, 0); if (joy) joy.classList.remove('active'); }
        else if (t.identifier === this.lookId) { this.lookId = null; }
        else if (this.fireIds.has(t.identifier)) { this.fireIds.delete(t.identifier); if (!this.fireIds.size) { this.s.fire = false; this.press('fireR'); } }
        if (this._hold && this._hold[t.identifier]) { const b = this._hold[t.identifier]; if (b.dataset.act === 'jump') this.s.jump = false; if (b.dataset.act === 'use') this.s.use = false; b.classList.remove('on'); delete this._hold[t.identifier]; }
      }
      root.querySelectorAll('[data-act=fire].on').forEach(b => { if (!this.fireIds.size) b.classList.remove('on'); });
    };
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
  }
}
