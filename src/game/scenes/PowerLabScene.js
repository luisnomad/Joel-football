import Phaser from 'phaser';
import { SUPERPOWERS, getSuperpower } from '../content/superpowers.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { chooseMathOperation, generateAnswerChoices, generateMathProblem, isCorrectAnswer } from '../pure/mathChallenge.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { bindButtonInput } from '../ui/buttonInput.js';
import { createPowerIcon, playPowerRewardBurst, powerIconTextureKey } from '../ui/powerRewardBurst.js';
import { renderMathExplanation } from '../ui/mathExplanation.js';

/** Tablet power cards: five tall cards filling the space above the action bar. */
const CARD_WIDTH = 232;
const CARD_HEIGHT = 300;
const cardPositions = SUPERPOWERS.map((_, index) => ({
  x: 144 + (index % 5) * 248,
  y: 368,
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
    this.returnScene = data.returnScene ?? 'Intro';
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

    this.stageLayout = createArenaStage(this).layout;
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x061225, 0x061225, 0x07101f, 0x07101f, 0.82, 0.82, 0.94, 0.94);
    wash.fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);
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
      onPress: () => this.scene.start(this.returnScene),
    });

    this.add.rectangle(640, 127, 440, 40, 0x0b1930, 0.76).setStrokeStyle(2, 0x7ce8ff, 0.22);
    this.levelText = this.add.text(640, 127, '', this.textStyle(15, '#bfeeff')).setOrigin(0.5);

    SUPERPOWERS.forEach((power, index) => this.createPowerCard(power, cardPositions[index]));
    this.createActionBar(this.stageLayout.bottomOffset);
    this.refreshAll();

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.challenge) this.closeChallenge();
      else this.scene.start(this.returnScene);
    });
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refreshLockUi() });

    // Test and debug API: development builds only (audit I6).
    if (import.meta.env.DEV) {
      window.__SKYHEAD_LAB_DEBUG__ = {
        selectPower: (powerId) => this.selectPower(powerId),
        openChallenge: () => this.openChallenge(),
        answer: (value) => this.answerChallenge(value),
        closeChallenge: () => this.closeChallenge(),
        profile: () => playerProfileStore.get(),
      };
    }
  }

  textStyle(size, color = '#ffffff') {
    return {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
    };
  }

  createPowerCard(power, { x, y: baseY }) {
    const y = baseY + Math.round(this.stageLayout.bottomOffset * 0.35);
    const top = y - CARD_HEIGHT / 2;
    const panel = this.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x0b1930, 0.92).setStrokeStyle(2, 0xffffff, 0.14);
    const iconDisc = this.add.circle(x, top + 66, 46, power.color, 0.22).setStrokeStyle(3, power.color, 0.8);
    // Painted icons replace the glyph automatically via the power-icon-<id> texture key.
    const icon = createPowerIcon(this, { x, y: top + 66, power, size: 64 });
    const name = this.add.text(x, top + 136, t(this.language, power.nameKey), {
      ...this.textStyle(21, '#ffffff'),
      align: 'center',
      wordWrap: { width: CARD_WIDTH - 24 },
    }).setOrigin(0.5);
    const description = this.add.text(x, top + 194, t(this.language, power.descriptionKey), {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '15px',
      color: '#c4d6eb',
      align: 'center',
      wordWrap: { width: CARD_WIDTH - 32 },
      lineSpacing: 3,
    }).setOrigin(0.5);
    const count = this.add.text(x, top + CARD_HEIGHT - 30, '×0', this.textStyle(26, '#ffdc70')).setOrigin(0.5);
    const equipped = this.add.text(x + CARD_WIDTH / 2 - 26, top + 26, '✓', this.textStyle(24, '#73f7d3')).setOrigin(0.5).setVisible(false);
    const selectedTag = this.add.text(x, top - 2, t(this.language, 'lab.selected'), {
      ...this.textStyle(13, '#071426'),
      backgroundColor: '#ffdc70',
      padding: { x: 10, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    const zone = this.add.zone(x, y, CARD_WIDTH, CARD_HEIGHT).setInteractive({ useHandCursor: true });
    const parts = [panel, iconDisc, icon, name, description, count, equipped, selectedTag];
    bindButtonInput(this, zone, {
      onOver: () => panel.setScale(1.02),
      onOut: () => panel.setScale(1),
      onPress: () => panel.setScale(0.98),
      onRelease: () => panel.setScale(1.02),
      onActivate: () => this.selectPower(power.id),
    });
    this.cards.set(power.id, { panel, iconDisc, icon, name, description, count, equipped, selectedTag, zone, parts, y });
  }

  createActionBar(yOffset = 0) {
    this.add.rectangle(640, 641 + yOffset, 1120, 124, 0x071426, 0.94).setStrokeStyle(2, 0x8befff, 0.22);
    this.selectedIconDisc = this.add.circle(125, 641 + yOffset, 40, 0xffffff, 0.18);
    this.selectedIcon = this.add.text(125, 641 + yOffset, 'F', this.textStyle(32)).setOrigin(0.5);
    // Painted badge for the selected power; the glyph stays as fallback and as
    // the reward fly-in target.
    this.selectedIconImage = this.add.image(125, 641 + yOffset, '__DEFAULT').setVisible(false);
    this.selectedName = this.add.text(185, 603 + yOffset, '', this.textStyle(23, '#ffffff'));
    this.selectedDescription = this.add.text(185, 636 + yOffset, '', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '15px',
      color: '#b9cce3',
      wordWrap: { width: 360 },
    });
    this.selectedCount = this.add.text(185, 675 + yOffset, '', this.textStyle(16, '#ffdc70'));
    this.actionMessage = this.add.text(640, 684 + yOffset, '', this.textStyle(14, '#ffb7a8')).setOrigin(0.5);

    this.solveButton = createButton(this, {
      x: 805,
      y: 638 + yOffset,
      width: 300,
      height: 58,
      label: t(this.language, 'lab.solve'),
      color: 0x2a9eb5,
      onPress: () => this.openChallenge(),
    });
    this.equipButton = createButton(this, {
      x: 1090,
      y: 638 + yOffset,
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
    const level = playerProfileStore.get().mathProgress.level;
    this.levelText?.setText(`🎯  ${t(this.language, 'lab.randomMath', { level: t(this.language, `lab.level.${level}`) })}`);
    this.profile = playerProfileStore.get();
    SUPERPOWERS.forEach((power) => {
      const card = this.cards.get(power.id);
      const selected = power.id === this.selectedPowerId;
      const equipped = power.id === this.profile.equippedPowerId;
      card.panel.setFillStyle(selected ? 0x15365a : 0x0b1930, selected ? 0.98 : 0.88);
      card.panel.setStrokeStyle(selected ? 6 : 2, selected ? power.color : 0xffffff, selected ? 1 : 0.14);
      card.selectedTag.setVisible(selected);
      // The selected card lifts slightly; the others sit back a little.
      const lift = selected ? -10 : 0;
      card.parts.forEach((part) => {
        if (part.baseY === undefined) part.baseY = part.y;
        part.setY(part.baseY + lift);
      });
      card.iconDisc.setFillStyle(power.color, selected ? 0.36 : 0.18);
      card.count.setText(`×${this.profile.powers[power.id]}`);
      card.equipped.setVisible(equipped);
    });
    const selected = getSuperpower(this.selectedPowerId);
    this.selectedIconDisc.setFillStyle(selected.color, 0.2).setStrokeStyle(2, selected.color, 0.7);
    this.selectedIcon.setText(selected.icon);
    const selectedIconKey = powerIconTextureKey(selected.id);
    const painted = this.textures.exists(selectedIconKey);
    this.selectedIcon.setVisible(!painted);
    if (painted) this.selectedIconImage.setTexture(selectedIconKey).setDisplaySize(72, 72).setVisible(true);
    else this.selectedIconImage.setVisible(false);
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
  }

  openChallenge() {
    if (playerProfileStore.getMathLockRemaining(Date.now()) > 0 || this.challenge) return;
    arcadeAudio.click();
    const level = playerProfileStore.get().mathProgress.level;
    const operation = chooseMathOperation(Math.random, level);
    const problem = generateMathProblem(operation, Math.random, level);
    this.lastOperation = operation;
    const choices = generateAnswerChoices(problem);
    this.challenge = { problem, choices, status: 'answering', level, explained: false };

    const shade = this.add.rectangle(0, 0, GAME_WIDTH, this.stageLayout.height, 0x020711, 0.8).setOrigin(0).setDepth(200).setInteractive();
    const panel = this.add.rectangle(640, 362, 760, 620, 0x0b1930, 0.99).setDepth(201).setStrokeStyle(4, 0x7ce8ff, 0.45);
    const title = this.add.text(640, 95, t(this.language, 'lab.challenge'), this.textStyle(34)).setOrigin(0.5).setDepth(202);
    const levelBadge = this.challengeLevelBadge = this.add.text(970, 72, t(this.language, `lab.level.${level}`), this.textStyle(15, '#ffdd75'))
      .setOrigin(1, 0.5).setDepth(202);
    const power = getSuperpower(this.selectedPowerId);
    const powerLabel = this.add.text(640, 140, `${power.icon}  ${t(this.language, power.nameKey)}`, this.textStyle(21, '#ffdd75')).setOrigin(0.5).setDepth(202);
    const problemText = this.add.text(640, 228, `${problem.expression} = ?`, this.textStyle(62)).setOrigin(0.5).setDepth(202);
    const prompt = this.add.text(640, 290, t(this.language, 'lab.chooseAnswer'), this.textStyle(17, '#bcd1eb')).setOrigin(0.5).setDepth(202);
    this.challengePrompt = prompt;
    this.challengeFeedback = this.add.text(640, 470, '', {
      ...this.textStyle(18, '#ffb7a8'),
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(202);
    this.challengeObjects.push(shade, panel, title, levelBadge, powerLabel, problemText, prompt, this.challengeFeedback);

    this.answerButtons = choices.map((choice, index) => {
      const button = createButton(this, {
        x: 400 + index * 160,
        y: 380,
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
      y: 632,
      width: 240,
      height: 58,
      label: t(this.language, 'lab.continue'),
      color: 0x2a9eb5,
      onPress: () => this.closeChallenge(),
    });
    this.newProblemButton = createButton(this, {
      x: 640,
      y: 632,
      width: 260,
      height: 58,
      label: t(this.language, 'lab.newProblem'),
      color: 0x705cff,
      onPress: () => this.nextChallenge(),
    });
    [this.continueButton, this.newProblemButton].forEach((button) => {
      this.setButtonDepth(button, 203);
      button.setVisible(false);
      this.challengeObjects.push(button.shadow, button.background, button.text, button.zone);
    });
  }

  /** After a miss: straight into a fresh problem (unless a break started). */
  nextChallenge() {
    this.closeChallenge();
    if (playerProfileStore.getMathLockRemaining(Date.now()) <= 0) this.openChallenge();
  }

  positionWrongAnswerButtons() {
    const place = (button, x) => [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setX(x));
    place(this.newProblemButton, 505);
    place(this.continueButton, 790);
    this.newProblemButton.setVisible(true);
    this.continueButton.setVisible(true);
  }

  setButtonDepth(button, depth) {
    [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(depth));
  }

  answerChallenge(value) {
    if (!this.challenge || this.challenge.status !== 'answering') return;
    const { problem } = this.challenge;
    const correct = isCorrectAnswer(problem, value);
    this.answerButtons.forEach((button) => {
      button.zone.input.enabled = false;
      const choice = Number(button.text.text);
      if (choice === Number(value)) button.background.setFillStyle(correct ? 0x168c78 : 0xa83d50, 1);
      // A miss also shows which choice was right.
      else if (!correct && choice === problem.answer) button.background.setFillStyle(0x168c78, 1);
    });

    const power = getSuperpower(this.selectedPowerId);
    const outcome = playerProfileStore.recordMathAnswer(correct, Date.now());
    this.challenge.outcome = outcome;
    if (correct) {
      playerProfileStore.earn(power.id, outcome.bonusCharge ? 2 : 1);
      this.challenge.status = 'success';
      const lines = [t(this.language, 'lab.correct', { power: t(this.language, power.nameKey) })];
      if (outcome.bonusCharge) lines.push(t(this.language, 'lab.streakBonus', { power: t(this.language, power.nameKey) }));
      if (outcome.leveledUp) lines.push(t(this.language, 'lab.levelUp', { level: t(this.language, `lab.level.${outcome.level}`) }));
      this.challengeLevelBadge?.setText(t(this.language, `lab.level.${outcome.level}`));
      this.challengeFeedback.setColor('#7ff7d7').setText(lines.join('\n'));
      arcadeAudio.powerUp();
      // The earned charge flies from the problem into the selected-power slot.
      this.challengeObjects.push(...playPowerRewardBurst(this, {
        fromX: 640,
        fromY: 300,
        toX: this.selectedIcon.x,
        toY: this.selectedIcon.y,
        power,
        bonus: outcome.bonusCharge,
        bonusLabel: t(this.language, 'lab.bonusBadge'),
        onArrive: () => arcadeAudio.success(),
      }));
      this.continueButton.setVisible(true);
    } else {
      this.challenge.status = outcome.takeBreak ? 'locked' : 'wrong';
      this.challenge.explained = true;
      this.challengeLevelBadge?.setText(t(this.language, `lab.level.${outcome.level}`));
      this.challengeFeedback.setText('');
      this.challengeObjects.push(...renderMathExplanation(this, {
        x: 640,
        y: 462,
        problem,
        language: this.language,
        depth: 202,
      }));
      if (outcome.takeBreak || outcome.leveledDown) {
        const note = outcome.takeBreak ? t(this.language, 'lab.wrongCooldown') : t(this.language, 'lab.levelDown');
        // Replaces the answer prompt so it never collides with the explanation.
        this.challengePrompt.setText(note).setColor('#ffb7a8');
      }
      arcadeAudio.impact();
      if (outcome.takeBreak) {
        this.continueButton.setVisible(true);
        this.refreshLockUi();
      } else {
        this.positionWrongAnswerButtons();
      }
    }
    this.refreshAll();
  }

  closeChallenge() {
    if (!this.challenge) return;
    this.challengeObjects.forEach((object) => {
      this.tweens.killTweensOf(object);
      object.destroy();
    });
    this.challengeObjects = [];
    this.answerButtons = [];
    this.challenge = null;
    this.challengeFeedback = null;
    this.continueButton = null;
    this.newProblemButton = null;
    arcadeAudio.click();
    this.refreshAll();
  }

  handlePlatformBack() {
    if (this.challenge) this.closeChallenge();
    else this.scene.start(this.returnScene);
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    return {
      mode: 'power-lab',
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}; gameplay region 1280x720`,
      stageLayout: this.stageLayout,
      language: this.language,
      audio: arcadeAudio.diagnostics(),
      operationMode: 'adaptive',
      mathProgress: profile.mathProgress,
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
        level: this.challenge.level,
        explained: this.challenge.explained,
        outcome: this.challenge.outcome ?? null,
      } : null,
      actions: ['select power', 'solve random challenge to earn', 'equip power', 'back'],
    };
  }

  advanceForTesting() {
    this.refreshLockUi();
  }
}
