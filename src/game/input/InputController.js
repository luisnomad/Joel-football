import Phaser from 'phaser';
import { normalizeIntent } from '../pure/actions.js';
import { createDirectionTapState, registerDirectionTap } from '../pure/sprint.js';

const consumePulse = (state, name) => {
  const value = state[name];
  state[name] = false;
  return value;
};

export class InputController {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys({
      leftA: 'A',
      leftArrow: 'LEFT',
      rightD: 'D',
      rightArrow: 'RIGHT',
      jumpW: 'W',
      jumpArrow: 'UP',
      jumpSpace: 'SPACE',
      kickX: 'X',
      kickK: 'K',
      lobZ: 'Z',
      lobI: 'I',
      dashC: 'C',
      dashL: 'L',
      powerV: 'V',
      powerJ: 'J',
    });
    this.touch = { left: false, right: false, jump: false, kick: false, lob: false, dash: false, power: false };
    this.keyboardPulse = { power: false };
    this.directionTapState = createDirectionTapState();
    this.pendingSprintDirection = 0;
    this.sprintDirection = 0;
    this.onPowerDown = () => { this.keyboardPulse.power = true; };
    this.onLeftDown = () => this.recordDirectionPress(-1);
    this.onRightDown = () => this.recordDirectionPress(1);
    this.keys.powerV.on('down', this.onPowerDown);
    this.keys.powerJ.on('down', this.onPowerDown);
    this.keys.leftA.on('down', this.onLeftDown);
    this.keys.leftArrow.on('down', this.onLeftDown);
    this.keys.rightD.on('down', this.onRightDown);
    this.keys.rightArrow.on('down', this.onRightDown);
  }

  setTouch(action, down) {
    if (!(action in this.touch)) return;
    if (down && !this.touch[action] && (action === 'left' || action === 'right')) {
      this.recordDirectionPress(action === 'left' ? -1 : 1);
    }
    this.touch[action] = down;
  }

  recordDirectionPress(direction) {
    this.directionTapState = registerDirectionTap(this.directionTapState, {
      direction,
      at: this.scene.time.now,
    });
    if (this.directionTapState.sprintDirection) {
      this.pendingSprintDirection = this.directionTapState.sprintDirection;
    }
  }

  resetAdvancedInput() {
    this.directionTapState = createDirectionTapState();
    this.pendingSprintDirection = 0;
    this.sprintDirection = 0;
  }

  neutralize() {
    Object.keys(this.touch).forEach((action) => { this.touch[action] = false; });
    Object.keys(this.keyboardPulse).forEach((action) => { this.keyboardPulse[action] = false; });
    this.scene.input.keyboard.resetKeys?.();
    Object.values(this.keys).forEach((key) => key.reset?.());
    this.resetAdvancedInput();
  }

  sample(self = {}) {
    const { JustDown } = Phaser.Input.Keyboard;
    const left = this.keys.leftA.isDown || this.keys.leftArrow.isDown || this.touch.left;
    const right = this.keys.rightD.isDown || this.keys.rightArrow.isDown || this.touch.right;
    const jumpHeld = this.keys.jumpW.isDown || this.keys.jumpArrow.isDown || this.keys.jumpSpace.isDown;
    const jumpPressed =
      JustDown(this.keys.jumpW) ||
      JustDown(this.keys.jumpArrow) ||
      JustDown(this.keys.jumpSpace) ||
      consumePulse(this.touch, 'jump');
    const kickPressed = JustDown(this.keys.kickX) || JustDown(this.keys.kickK) || consumePulse(this.touch, 'kick');
    const lobPressed = JustDown(this.keys.lobZ) || JustDown(this.keys.lobI) || consumePulse(this.touch, 'lob');
    const modifierLob = kickPressed && jumpHeld;
    const requestedShot = kickPressed || lobPressed;
    const kickBoost = requestedShot && self.kickTimer > 0 && !self.powerArmed ? 1 : 0;
    const move = Number(right) - Number(left);
    if (this.pendingSprintDirection) {
      const canStart = self.grounded !== false
        && !self.stunned
        && !self.dashTimer
        && move === this.pendingSprintDirection;
      this.sprintDirection = canStart ? this.pendingSprintDirection : 0;
      this.pendingSprintDirection = 0;
      if (!canStart) this.directionTapState = createDirectionTapState();
    }
    if (self.stunned || self.dashTimer > 0 || move !== this.sprintDirection) {
      this.sprintDirection = 0;
    }
    return normalizeIntent({
      move,
      jump: jumpPressed && !kickPressed,
      kick: !kickBoost && kickPressed && !modifierLob,
      lob: !kickBoost && (lobPressed || modifierLob),
      dash: JustDown(this.keys.dashC) || JustDown(this.keys.dashL) || consumePulse(this.touch, 'dash'),
      power: consumePulse(this.keyboardPulse, 'power') || consumePulse(this.touch, 'power'),
      sprint: this.sprintDirection !== 0,
      kickBoost,
    });
  }

  destroy() {
    this.keys.powerV.off('down', this.onPowerDown);
    this.keys.powerJ.off('down', this.onPowerDown);
    this.keys.leftA.off('down', this.onLeftDown);
    this.keys.leftArrow.off('down', this.onLeftDown);
    this.keys.rightD.off('down', this.onRightDown);
    this.keys.rightArrow.off('down', this.onRightDown);
  }
}
