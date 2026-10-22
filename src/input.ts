import { DEFAULT_BINDINGS } from './data';
/** 键盘与多点触控只写入统一动作集合；战斗模块不直接读取 DOM。 */
export class Input {
  held = new Set<string>(); pressed = new Set<string>(); private keyboard = new Set<string>();
  private touch = new Map<number, string>(); private bindings: Record<string, string>;
  private stickPointer: number | null = null; private stick: HTMLElement | null = null;
  private stickActions = new Set<string>(); private stickX = 0;
  capture: ((code: string) => void) | null = null;
  onPause: () => void = () => {};
  constructor(bindings = DEFAULT_BINDINGS) {
    this.bindings = { ...bindings };
    window.addEventListener('keydown', e => {
      if (this.capture) { e.preventDefault(); const cb = this.capture; this.capture = null; cb(e.code); return; }
      if ((e.target as HTMLElement)?.matches('input,select,textarea')) return;
      const action = this.action(e.code);
      if (!action) return;
      e.preventDefault();
      if (!e.repeat && action === 'pause') this.onPause();
      this.keyboard.add(e.code); this.rebuild();
    });
    window.addEventListener('keyup', e => { this.keyboard.delete(e.code); this.rebuild(); });
    window.addEventListener('blur', () => this.clear());
  }
  private action(code: string) {
    return ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as Record<string, string>)[code] || Object.keys(this.bindings).find(k => this.bindings[k] === code);
  }
  private rebuild() {
    const next = new Set<string>();
    for (const key of this.keyboard) { const action = this.action(key); if (action) next.add(action); }
    for (const action of this.touch.values()) next.add(action);
    for (const action of this.stickActions) next.add(action);
    for (const action of next) if (!this.held.has(action)) this.pressed.add(action);
    this.held = next;
  }
  attachTouch(container: HTMLElement) {
    container.addEventListener('contextmenu', e => e.preventDefault());
    container.addEventListener('pointerdown', e => {
      const stick = (e.target as HTMLElement).closest<HTMLElement>('[data-stick]');
      if (stick && this.stickPointer === null) {
        e.preventDefault(); this.stickPointer = e.pointerId; this.stick = stick;
        stick.setPointerCapture(e.pointerId); stick.classList.add('engaged'); this.moveStick(e.clientX, e.clientY); return;
      }
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-touch]');
      if (!button) return;
      e.preventDefault(); button.setPointerCapture(e.pointerId);
      this.touch.set(e.pointerId, button.dataset.touch!); button.classList.add('held'); this.rebuild();
    });
    container.addEventListener('pointermove', e => {
      if (e.pointerId !== this.stickPointer) return;
      e.preventDefault(); this.moveStick(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.stickPointer) this.resetStick();
      this.touch.delete(e.pointerId); this.rebuild();
      container.querySelectorAll<HTMLElement>('[data-touch]').forEach(b => b.classList.toggle('held', [...this.touch.values()].includes(b.dataset.touch!)));
    };
    container.addEventListener('pointerup', release); container.addEventListener('pointercancel', release);
    container.addEventListener('lostpointercapture', release);
  }
  setBindings(b: Record<string, string>) { this.bindings = { ...b }; this.clear(); }
  /** 键盘保持全速；摇杆有 18% 死区，剩余行程连续映射，轻推可慢走。 */
  horizontal() {
    if (this.stickPointer !== null) return this.stickX;
    return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
  }
  private moveStick(clientX: number, clientY: number) {
    if (!this.stick) return;
    const rect = this.stick.getBoundingClientRect(), radius = rect.width * .32;
    let dx = (clientX - rect.x - rect.width / 2) / radius, dy = (clientY - rect.y - rect.height / 2) / radius;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) { dx /= distance; dy /= distance; }
    this.stickActions.clear();
    this.stickX = Math.abs(dx) < .18 ? 0 : Math.sign(dx) * (Math.abs(dx) - .18) / .82;
    if (this.stickX < 0) this.stickActions.add('left');
    if (this.stickX > 0) this.stickActions.add('right');
    if (dy < -.42) this.stickActions.add('up');
    if (dy > .42) this.stickActions.add('down');
    // CSS 使用未缩放的像素；指针计算使用实际布局，按钮大小设置不改变手感。
    const thumb = this.stick.querySelector<HTMLElement>('[data-stick-thumb]');
    if (thumb) thumb.style.transform = `translate(${dx * 42}px, ${dy * 42}px)`;
    this.rebuild();
  }
  private resetStick() {
    const thumb = this.stick?.querySelector<HTMLElement>('[data-stick-thumb]');
    if (thumb) thumb.style.transform = 'translate(0px, 0px)';
    this.stick?.classList.remove('engaged'); this.stickPointer = null; this.stick = null; this.stickX = 0; this.stickActions.clear();
  }
  down(a: string) { return this.held.has(a); }
  tap(a: string) { return this.pressed.has(a); }
  endStep() { this.pressed.clear(); }
  clear() { this.resetStick(); this.held.clear(); this.pressed.clear(); this.keyboard.clear(); this.touch.clear(); document.querySelectorAll('.held').forEach(b => b.classList.remove('held')); }
}
