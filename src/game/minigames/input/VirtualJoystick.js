import { resolveVirtualJoystickVector } from './virtualJoystickMath.js';

const GLASS_TINT = 0xdaf7ff;
const GLASS_SHADOW = 0x04101e;

export class VirtualJoystick {
  constructor(scene, {
    x = 0,
    y = 0,
    radius = 82,
    thumbRadius = radius * 0.4,
    interactionRadius = radius * 1.34,
    deadZone = 0.24,
    accent = 0x50d8ef,
    depth = 85,
    fixedToCamera = true,
    haptic = 'light',
    onChange = null,
  } = {}) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.radius = Math.max(1, radius);
    this.thumbRadius = Math.max(1, thumbRadius);
    this.interactionRadius = Math.max(this.radius, interactionRadius);
    this.deadZone = deadZone;
    this.accent = accent;
    this.depth = depth;
    this.fixedToCamera = fixedToCamera;
    this.haptic = haptic;
    this.onChange = typeof onChange === 'function' ? onChange : null;
    this.pointer = null;
    this.visible = true;
    this.enabled = true;
    this.state = resolveVirtualJoystickVector({ radius: this.radius, deadZone: this.deadZone });

    this.createVisuals();
    this.bindInput();
    this.updateVisuals();
  }

  createVisuals() {
    this.shadow = this.scene.add.circle(
      this.x,
      this.y + 6,
      this.radius + 4,
      GLASS_SHADOW,
      0.2,
    ).setDepth(this.depth);
    this.glow = this.scene.add.circle(
      this.x,
      this.y,
      this.radius + 5,
      this.accent,
      0.035,
    ).setStrokeStyle(3, this.accent, 0.2).setDepth(this.depth + 0.1);
    this.base = this.scene.add.circle(
      this.x,
      this.y,
      this.radius,
      GLASS_TINT,
      0.105,
    ).setStrokeStyle(2, 0xf4fdff, 0.48).setDepth(this.depth + 0.2);
    this.innerRim = this.scene.add.circle(
      this.x,
      this.y,
      this.radius - 8,
      this.accent,
      0.025,
    ).setStrokeStyle(1.5, this.accent, 0.2).setDepth(this.depth + 0.3);
    this.deadZoneRing = this.scene.add.circle(
      this.x,
      this.y,
      Math.max(8, this.radius * this.deadZone),
      GLASS_TINT,
      0.025,
    ).setStrokeStyle(1, 0xffffff, 0.13).setDepth(this.depth + 0.35);

    this.guides = this.scene.add.graphics({ x: this.x, y: this.y }).setDepth(this.depth + 0.4);
    this.guides.lineStyle(2, 0xcaf7ff, 0.22);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      this.guides.beginPath();
      this.guides.moveTo(
        Math.cos(angle) * this.radius * 0.7,
        Math.sin(angle) * this.radius * 0.7,
      );
      this.guides.lineTo(
        Math.cos(angle) * this.radius * 0.84,
        Math.sin(angle) * this.radius * 0.84,
      );
      this.guides.strokePath();
    }

    this.thumbShadow = this.scene.add.circle(
      this.x,
      this.y + 4,
      this.thumbRadius + 3,
      GLASS_SHADOW,
      0.28,
    ).setDepth(this.depth + 1);
    this.thumb = this.scene.add.circle(
      this.x,
      this.y,
      this.thumbRadius,
      this.accent,
      0.32,
    ).setStrokeStyle(2.5, 0xf4fdff, 0.7).setDepth(this.depth + 1.1);
    this.thumbCore = this.scene.add.circle(
      this.x,
      this.y,
      this.thumbRadius * 0.46,
      0xf4fdff,
      0.13,
    ).setDepth(this.depth + 1.2);
    this.zone = this.scene.add.circle(
      this.x,
      this.y,
      this.interactionRadius,
      0xffffff,
      0.001,
    ).setDepth(this.depth + 2).setInteractive({ useHandCursor: true });

    this.baseObjects = [
      this.shadow,
      this.glow,
      this.base,
      this.innerRim,
      this.deadZoneRing,
      this.guides,
      this.zone,
    ];
    this.thumbObjects = [this.thumbShadow, this.thumb, this.thumbCore];
    this.objects = [...this.baseObjects, ...this.thumbObjects];
    if (this.fixedToCamera) this.objects.forEach((object) => object.setScrollFactor(0));
  }

  bindInput() {
    this.zone.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);
    this.scene.input.on('pointerupoutside', this.handlePointerUp, this);
    this.scene.input.on('gameout', this.handleGameOut, this);
  }

  handlePointerDown(pointer) {
    if (!this.enabled || this.pointer) return;
    this.pointer = pointer;
    this.updateFromPointer(pointer);
    if (this.haptic) this.scene.game.events.emit('platform:haptic', this.haptic);
  }

  handlePointerMove(pointer) {
    if (pointer !== this.pointer) return;
    if (!pointer.isDown) {
      this.reset();
      return;
    }
    this.updateFromPointer(pointer);
  }

  handlePointerUp(pointer) {
    if (pointer === this.pointer) this.reset();
  }

  handleGameOut() {
    if (this.pointer) this.reset();
  }

  updateFromPointer(pointer) {
    const camera = pointer.camera ?? this.scene.cameras.main;
    const worldPoint = camera.getWorldPoint(pointer.x, pointer.y);
    const originX = this.x - camera.scrollX * (this.base.scrollFactorX - 1);
    const originY = this.y - camera.scrollY * (this.base.scrollFactorY - 1);
    this.setState(resolveVirtualJoystickVector({
      dx: worldPoint.x - originX,
      dy: worldPoint.y - originY,
      radius: this.radius,
      deadZone: this.deadZone,
    }));
  }

  setState(state, { notify = true } = {}) {
    this.state = state;
    this.updateVisuals();
    if (notify) this.onChange?.(this.state);
    return this;
  }

  updateVisuals() {
    const thumbX = this.x + this.state.thumbX;
    const thumbY = this.y + this.state.thumbY;
    this.thumbShadow.setPosition(thumbX, thumbY + 4);
    this.thumb.setPosition(thumbX, thumbY);
    this.thumbCore.setPosition(thumbX, thumbY);
    this.thumb.setScale(this.state.active ? 1.06 : 1);
    this.thumbCore.setScale(this.state.active ? 1.08 : 1);
    this.glow.setAlpha(this.state.active ? 1 : 0.55);
    this.base.setFillStyle(GLASS_TINT, this.state.active ? 0.14 : 0.105);
  }

  getState() {
    return this.state;
  }

  reset({ notify = true } = {}) {
    this.pointer = null;
    return this.setState(resolveVirtualJoystickVector({
      radius: this.radius,
      deadZone: this.deadZone,
    }), { notify });
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.reset();
    if (this.zone.input) this.zone.input.enabled = this.enabled && this.visible;
    return this;
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    if (!this.visible) this.reset();
    this.objects.forEach((object) => object.setVisible(this.visible));
    if (this.zone.input) this.zone.input.enabled = this.enabled && this.visible;
    return this;
  }

  diagnostics() {
    return {
      visible: this.visible,
      enabled: this.enabled,
      pointerId: this.pointer?.id ?? null,
      x: this.x,
      y: this.y,
      radius: this.radius,
      interactionRadius: this.interactionRadius,
      deadZone: this.deadZone,
      ...this.state,
    };
  }

  destroy() {
    if (!this.scene) return;
    this.reset();
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUp, this);
    this.scene.input.off('gameout', this.handleGameOut, this);
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.pointer = null;
    this.scene = null;
  }
}
