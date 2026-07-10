import Phaser from 'phaser';
import { SUPERPOWERS, getSuperpower } from '../content/superpowers.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { chooseMathOperation, generateAnswerChoices, generateMathProblem, isCorrectAnswer } from '../pure/mathChallenge.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';

const cardPositions = SUPERPOWERS.map((_, index) => ({
  x: 144 + (index % 5) * 248,
  y: index < 5 ? 270 : 460,
}));

const formatRemaining = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export class PowerLabScene extends Phaser.Scene {
  constructor() {
    super('PowerLab');
  }

  create(data = {}) {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    arcadeAudio.setScene('menu');
    this.selectedPowerId = getSuperpower(data.selectedPowerId)?.id
      ?? this.profile.equippedPowerId
      ?? SUPERPOWERS[0].id;
    this.lastOperation = null;
    this.challenge = null;
    this.challengeObjects = [];
    this.cards = new Map();

    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      delete window.__SKYHEAD_LAB_DEBUG__;
    });

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'arena').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x061225, 0x061225, 0x07101f, 0x07101f, 0.82, 0.82, 0.94, 0.94);
    wash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(640, 78, GAME_WIDTH, 156, 0x061225, 0.42);

    this.add.text(640, 38, t(this.language, 'lab.title'), this.textStyle(42, '#ffffff')).setOrigin(0.5);
    this.add.text(640, 80, t(this.language, 'lab.subtitle'), this.textStyle(17, '#bfeeff')).setOrigin(0.5);

    createButton(this, {
      x: 74,
      y: 48,
      width: 112,
      height: 42,
      label: `‹  ${t(this.language, 'lab.back')}`,
      color: 0x173858,
      onPress: () => this.scene.start('Intro'),
    });

    this.add.rectangle(640, 127, 440, 40, 0x0b1930, 0.76).setStrokeStyle(2, 0x7ce8ff, 0.22);
    this.add.text(640, 127, `🎲  ${t(this.language, 'lab.randomMath')}`, this.textStyle(15, '#bfeeff')).setOrigin(0.5);

    SUPERPOWERS.forEach((power, index) => this.createPowerCard(power, cardPositions[index]));
    this.createActionBar();
    this.refreshAll();

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.challenge) this.closeChallenge();
      else this.scene.start('Intro');
    });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refreshLockUi() });

    window.__SKYHEAD_LAB_DEBUG__ = {
      selectPower: (powerId) => this.selectPower(powerId),
      openChallenge: () => this.openChallenge(),
      answer: (value) => this.answerChallenge(value),
      closeChallenge: () => this.closeChallenge(),
      profile: () => playerProfileStore.get(),
    };
  }

  textStyle(size, color = '#ffffff') {
    return {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
    };
  }

  createPowerCard(power, { x, y }) {
    const panel = this.add.rectangle(x, y, 220, 164, 0x0b1930, 0.9).setStrokeStyle(2, 0xffffff, 0.14);
    const iconDisc = this.add.circle(x - 70, y - 43, 33, power.color, 0.2).setStrokeStyle(2, power.color, 0.72);
    const icon = this.add.text(x - 70, y - 43, power.icon, this.textStyle(28, '#ffffff')).setOrigin(0.5);
    const name = this.add.text(x - 25, y - 55, t(this.language, power.nameKey), {
      ...this.textStyle(17, '#ffffff'),
      wordWrap: { width: 120 },
      lineSpacing: 2,
    }).setOrigin(0, 0);
    const description = this.add.text(x - 96, y + 2, t(this.language, power.descriptionKey), {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '13px',
      color: '#b9cce3',
      align: 'center',
      wordWrap: { width: 192 },
      lineSpacing: 2,
    }).setOrigin(0, 0);
    const count = this.add.text(x - 82, y + 58, '×0', this.textStyle(19, '#ffdc70')).setOrigin(0.5);
    const equipped = this.add.text(x + 76, y + 58, '✓', this.textStyle(19, '#73f7d3')).setOrigin(0.5).setVisible(false);
    const zone = this.add.zone(x, y, 220, 164).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => panel.setScale(1.025));
    zone.on('pointerout', () => panel.setScale(1));
    zone.on('pointerdown', () => panel.setScale(0.98));
    zone.on('pointerup', () => {
      panel.setScale(1.025);
      this.selectPower(power.id);
    });
    this.cards.set(power.id, { panel, iconDisc, icon, name, description, count, equipped, zone });
  }

  createActionBar() {
    this.add.rectangle(640, 641, 1120, 124, 0x071426, 0.94).setStrokeStyle(2, 0x8befff, 0.22);
    this.selectedIconDisc = this.add.circle(125, 641, 40, 0xffffff, 0.18);
    this.selectedIcon = this.add.text(125, 641, 'F', this.textStyle(32)).setOrigin(0.5);
    this.selectedName = this.add.text(185, 603, '', this.textStyle(23, '#ffffff'));
    this.selectedDescription = this.add.text(185, 636, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '15px',
      color: '#b9cce3',
      wordWrap: { width: 360 },
    });
    this.selectedCount = this.add.text(185, 675, '', this.textStyle(16, '#ffdc70'));
    this.actionMessage = this.add.text(640, 684, '', this.textStyle(14, '#ffb7a8')).setOrigin(0.5);

    this.solveButton = createButton(this, {
      x: 805,
      y: 638,
      width: 300,
      height: 58,
      label: t(this.language, 'lab.solve'),
      color: 0x2a9eb5,
      onPress: () => this.openChallenge(),
    });
    this.equipButton = createButton(this, {
      x: 1090,
      y: 638,
      width: 210,
      height: 58,
      label: t(this.language, 'lab.equip'),
      color: 0x705cff,
      onPress: () => this.equipSelected(),
    });
  }

  selectPower(powerId) {
    if (!getSuperpower(powerId)) return;
    this.selectedPowerId = powerId;
    this.actionMessage.setText('');
    arcadeAudio.click();
    this.refreshAll();
  }

  equipSelected() {
    const count = this.profile.powers[this.selectedPowerId] ?? 0;
    if (count <= 0) {
      this.actionMessage.setText(t(this.language, 'lab.earnFirst'));
      return;
    }
    playerProfileStore.equip(this.selectedPowerId);
    arcadeAudio.click();
    this.actionMessage.setText('');
    this.refreshAll();
  }

  refreshAll() {
    this.profile = playerProfileStore.get();
    SUPERPOWERS.forEach((power) => {
      const card = this.cards.get(power.id);
      const selected = power.id === this.selectedPowerId;
      const equipped = power.id === this.profile.equippedPowerId;
      card.panel.setFillStyle(selected ? 0x14324d : 0x0b1930, selected ? 0.98 : 0.9);
      card.panel.setStrokeStyle(selected ? 4 : 2, selected ? power.color : 0xffffff, selected ? 0.8 : 0.14);
      card.count.setText(`×${this.profile.powers[power.id]}`);
      card.equipped.setVisible(equipped);
    });
    const selected = getSuperpower(this.selectedPowerId);
    this.selectedIconDisc.setFillStyle(selected.color, 0.2).setStrokeStyle(2, selected.color, 0.7);
    this.selectedIcon.setText(selected.icon);
    this.selectedName.setText(t(this.language, selected.nameKey));
    this.selectedDescription.setText(t(this.language, selected.descriptionKey));
    this.selectedCount.setText(`${t(this.language, 'lab.charges')}: ${this.profile.powers[selected.id]}`);
    const isEquipped = this.profile.equippedPowerId === selected.id;
    this.equipButton.text.setText(isEquipped ? `✓ ${t(this.language, 'lab.equipped')}` : t(this.language, 'lab.equip'));
    this.equipButton.background.setFillStyle(isEquipped ? 0x168c78 : 0x705cff, 1);
    this.refreshLockUi();
  }

  refreshLockUi() {
    if (!this.solveButton) return;
    const remaining = playerProfileStore.getMathLockRemaining(Date.now());
    const locked = remaining > 0;
    this.solveButton.zone.input.enabled = !locked;
    this.solveButton.background.setFillStyle(locked ? 0x39485a : 0x2a9eb5, 1);
    this.solveButton.text.setText(locked
      ? t(this.language, 'lab.tryAgainIn', { time: formatRemaining(remaining) })
      : t(this.language, 'lab.solve'));
    if (this.challenge?.status === 'locked' && this.challengeFeedback) {
      this.challengeFeedback.setText(
        `${t(this.language, 'lab.wrongCooldown')}\n${t(this.language, 'lab.tryAgainIn', { time: formatRemaining(remaining) })}`,
      );
    }
  }

  openChallenge() {
    if (playerProfileStore.getMathLockRemaining(Date.now()) > 0 || this.challenge) return;
    arcadeAudio.click();
    const operation = chooseMathOperation();
    const problem = generateMathProblem(operation);
    this.lastOperation = operation;
    const choices = generateAnswerChoices(problem.answer);
    this.challenge = { problem, choices, status: 'answering' };

    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020711, 0.8).setOrigin(0).setDepth(200).setInteractive();
    const panel = this.add.rectangle(640, 360, 760, 560, 0x0b1930, 0.99).setDepth(201).setStrokeStyle(4, 0x7ce8ff, 0.45);
    const title = this.add.text(640, 125, t(this.language, 'lab.challenge'), this.textStyle(34)).setOrigin(0.5).setDepth(202);
    const power = getSuperpower(this.selectedPowerId);
    const powerLabel = this.add.text(640, 175, `${power.icon}  ${t(this.language, power.nameKey)}`, this.textStyle(21, '#ffdd75')).setOrigin(0.5).setDepth(202);
    const problemText = this.add.text(640, 278, `${problem.expression} = ?`, this.textStyle(62)).setOrigin(0.5).setDepth(202);
    const prompt = this.add.text(640, 343, t(this.language, 'lab.chooseAnswer'), this.textStyle(17, '#bcd1eb')).setOrigin(0.5).setDepth(202);
    this.challengeFeedback = this.add.text(640, 530, '', {
      ...this.textStyle(18, '#ffb7a8'),
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(202);
    this.challengeObjects.push(shade, panel, title, powerLabel, problemText, prompt, this.challengeFeedback);

    this.answerButtons = choices.map((choice, index) => {
      const button = createButton(this, {
        x: 400 + index * 160,
        y: 430,
        width: 130,
        height: 74,
        label: String(choice),
        color: 0x254f78,
        onPress: () => this.answerChallenge(choice),
      });
      this.setButtonDepth(button, 203);
      this.challengeObjects.push(button.shadow, button.background, button.text, button.zone);
      return button;
    });

    this.continueButton = createButton(this, {
      x: 640,
      y: 595,
      width: 240,
      height: 58,
      label: t(this.language, 'lab.continue'),
      color: 0x2a9eb5,
      onPress: () => this.closeChallenge(),
    });
    this.setButtonDepth(this.continueButton, 203);
    this.continueButton.setVisible(false);
    this.challengeObjects.push(
      this.continueButton.shadow,
      this.continueButton.background,
      this.continueButton.text,
      this.continueButton.zone,
    );
  }

  setButtonDepth(button, depth) {
    [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(depth));
  }

  answerChallenge(value) {
    if (!this.challenge || this.challenge.status !== 'answering') return;
    const correct = isCorrectAnswer(this.challenge.problem, value);
    this.answerButtons.forEach((button) => {
      button.zone.input.enabled = false;
      const selected = Number(button.text.text) === Number(value);
      if (selected) button.background.setFillStyle(correct ? 0x168c78 : 0xa83d50, 1);
    });

    const power = getSuperpower(this.selectedPowerId);
    if (correct) {
      playerProfileStore.earn(power.id);
      this.challenge.status = 'success';
      this.challengeFeedback.setColor('#7ff7d7').setText(
        t(this.language, 'lab.correct', { power: t(this.language, power.nameKey) }),
      );
      arcadeAudio.success();
    } else {
      playerProfileStore.lockMath(Date.now());
      this.challenge.status = 'locked';
      this.challengeFeedback.setColor('#ffb7a8');
      arcadeAudio.impact();
      this.refreshLockUi();
    }
    this.continueButton.setVisible(true);
    this.refreshAll();
  }

  closeChallenge() {
    if (!this.challenge) return;
    this.challengeObjects.forEach((object) => object.destroy());
    this.challengeObjects = [];
    this.answerButtons = [];
    this.challenge = null;
    this.challengeFeedback = null;
    this.continueButton = null;
    arcadeAudio.click();
    this.refreshAll();
  }

  serializeState() {
    const profile = playerProfileStore.get();
    return {
      mode: 'power-lab',
      coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
      language: this.language,
      audio: arcadeAudio.diagnostics(),
      operationMode: 'random',
      lastOperation: this.lastOperation,
      selectedPowerId: this.selectedPowerId,
      equippedPowerId: profile.equippedPowerId,
      powers: profile.powers,
      mathLockRemainingMs: playerProfileStore.getMathLockRemaining(Date.now()),
      challenge: this.challenge ? {
        operation: this.challenge.problem.operation,
        left: this.challenge.problem.left,
        right: this.challenge.problem.right,
        symbol: this.challenge.problem.symbol,
        expression: this.challenge.problem.expression,
        choices: this.challenge.choices,
        status: this.challenge.status,
      } : null,
      actions: ['select power', 'solve random challenge to earn', 'equip power', 'back'],
    };
  }

  advanceForTesting() {
    this.refreshLockUi();
  }
}
