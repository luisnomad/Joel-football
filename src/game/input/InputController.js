import Phaser from 'phaser';
import { normalizeIntent } from '../pure/actions.js';

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
    this.onPowerDown = () => { this.keyboardPulse.power = true; };
    this.keys.powerV.on('down', this.onPowerDown);
    this.keys.powerJ.on('down', this.onPowerDown);
  }

  setTouch(action, down) {
    if (action in this.touch) this.touch[action] = down;
  }

  sample() {
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
    return normalizeIntent({
      move: Number(right) - Number(left),
      jump: jumpPressed && !kickPressed,
      kick: kickPressed && !modifierLob,
      lob: lobPressed || modifierLob,
      dash: JustDown(this.keys.dashC) || JustDown(this.keys.dashL) || consumePulse(this.touch, 'dash'),
      power: consumePulse(this.keyboardPulse, 'power') || consumePulse(this.touch, 'power'),
    });
  }

  destroy() {
    this.keys.powerV.off('down', this.onPowerDown);
    this.keys.powerJ.off('down', this.onPowerDown);
  }
}
