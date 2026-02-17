/**
 * Input manager for keyboard and touch controls.
 * Tracks key states and provides a clean API for querying input.
 */

class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this._listeners = [];
    this._touchActive = { left: false, right: false, jump: false };
    this._bound = false;
  }

  bind(element) {
    if (this._bound) return;
    this._bound = true;

    const onKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Escape', 'p', 'P', 'Enter', 'x', 'X', 'z', 'Z'].includes(e.key)) {
        e.preventDefault();
      }
      if (!this.keys[e.key]) {
        this.justPressed[e.key] = true;
      }
      this.keys[e.key] = true;
    };

    const onKeyUp = (e) => {
      this.keys[e.key] = false;
    };

    const onBlur = () => {
      this.keys = {};
      this.justPressed = {};
    };

    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    this._listeners.push(
      { el: element, type: 'keydown', fn: onKeyDown },
      { el: element, type: 'keyup', fn: onKeyUp },
      { el: window, type: 'blur', fn: onBlur }
    );
  }

  bindTouchControls(leftBtn, rightBtn, jumpBtn) {
    const bindTouch = (btn, key) => {
      if (!btn) return;
      const start = (e) => { e.preventDefault(); this.keys[key] = true; };
      const end = (e) => { e.preventDefault(); this.keys[key] = false; };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      this._listeners.push(
        { el: btn, type: 'touchstart', fn: start },
        { el: btn, type: 'touchend', fn: end },
        { el: btn, type: 'touchcancel', fn: end }
      );
    };

    bindTouch(leftBtn, 'ArrowLeft');
    bindTouch(rightBtn, 'ArrowRight');
    bindTouch(jumpBtn, 'ArrowUp');
  }

  isDown(key) {
    return !!this.keys[key];
  }

  isJustPressed(key) {
    return !!this.justPressed[key];
  }

  get left() { return this.isDown('ArrowLeft') || this.isDown('a') || this.isDown('A'); }
  get right() { return this.isDown('ArrowRight') || this.isDown('d') || this.isDown('D'); }
  get jump() { return this.isDown('ArrowUp') || this.isDown('w') || this.isDown('W') || this.isDown(' '); }
  get fire() { return this.isJustPressed('x') || this.isJustPressed('X') || this.isJustPressed('z') || this.isJustPressed('Z'); }
  get pause() { return this.isJustPressed('Escape') || this.isJustPressed('p') || this.isJustPressed('P'); }

  clearJustPressed() {
    this.justPressed = {};
  }

  destroy() {
    for (const { el, type, fn } of this._listeners) {
      el.removeEventListener(type, fn);
    }
    this._listeners = [];
    this.keys = {};
    this.justPressed = {};
    this._bound = false;
  }
}

export { InputManager };
