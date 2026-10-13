import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { SUPERPOWERS, getSuperpower } from '../content/superpowers.js';
import { t } from '../i18n.js';
import { createPowerIcon } from '../ui/powerRewardBurst.js';
import { chooseMathOperation, generateAnswerChoices, generateMathProblem, isCorrectAnswer } from '../pure/mathChallenge.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { renderMathExplanation } from '../ui/mathExplanation.js';
import {
  compactBodyText,
  compactTextStyle,
  createCompactBackdrop,
  createCompactButton,
  createCompactHeader,
  createCompactPanel,
} from './compactUi.js';
import { playPowerRewardBurst } from '../ui/powerRewardBurst.js';

const setButtonDepth = (button, depth) => {
  button.objects.forEach((object, index) => object.setDepth(depth + index * 0.1));
  return button;
};

const setPanelDepth = (panel, depth) => {
  const [shadow, outer, middle, highlight] = panel.chrome;
  const objects = [shadow, outer, middle, panel, highlight];
  objects.forEach((object, index) => object.setDepth(depth + index * 0.03));
  return objects;
};

export class PowerLabScene extends Phaser.Scene {
  constructor() {
    super('PowerLab');
  }

  create(data = {}) {
    this.returnScene = 'Customize';
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.selectedPowerId = getSuperpower(data.selectedPowerId)?.id ?? this.profile.equippedPowerId ?? SUPERPOWERS[0].id;
    this.challenge = null;
    this.lastOperation = null;
    this.challengeObjects = [];
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      delete window.__SKYHEAD_LAB_DEBUG__;
    });
    this.stageLayout = createArenaStage(this).layout;
    createCompactBackdrop(this, { top: 0x061225, bottom: 0x07101f });
    createCompactHeader(this, {
      title: t(this.language, 'lab.title'),
      backLabel: t(this.language, 'lab.back'),
      onBack: () => this.back(),
      accent: 0xb47aff,
    });
    this.createPowerPage();
    this.input.keyboard.on('keydown-ESC', () => this.challenge ? this.closeChallenge() : this.back());
    // "New problem" after a miss restarts the scene straight into a challenge.
    if (data.openChallenge) this.openChallenge();
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

  createPowerPage() {
    const power = getSuperpower(this.selectedPowerId);
    const index = SUPERPOWERS.findIndex(({ id }) => id === power.id);
    createCompactPanel(this, { y: 360, width: 1000, height: 455, accent: power.color });
    this.add.text(640, 150, `${index + 1} / ${SUPERPOWERS.length}`, compactTextStyle(22, '#a9bdd8')).setOrigin(0.5);
    this.add.circle(370, 350, 125, power.color, 0.2).setStrokeStyle(5, power.color, 0.72);
    createPowerIcon(this, { x: 370, y: 350, power, size: 210 });
    createCompactButton(this, { x: 180, y: 350, width: 76, height: 120, label: '‹', color: 0x1a395c, activateOnPointerDown: true, onPress: () => this.cyclePower(-1) });
    createCompactButton(this, { x: 1100, y: 350, width: 76, height: 120, label: '›', color: 0x1a395c, activateOnPointerDown: true, onPress: () => this.cyclePower(1) });
    this.add.text(790, 235, t(this.language, power.nameKey), compactTextStyle(38, '#ffffff', { fontFamily: 'Arial Black, sans-serif' })).setOrigin(0.5);
    compactBodyText(this, 790, 345, t(this.language, power.descriptionKey), { width: 500, size: 27, color: '#d7e8f8' });
    this.add.text(790, 455, `${t(this.language, 'lab.charges')}: ${this.profile.powers[power.id]}`, compactTextStyle(24, '#ffdc72')).setOrigin(0.5);
    const equipped = this.profile.equippedPowerId === power.id;
    createCompactButton(this, { x: 520, y: 560, width: 380, height: 68, label: t(this.language, 'lab.solve'), color: 0x2a9eb5, accent: 0x20d9ff, onPress: () => this.openChallenge() });
    createCompactButton(this, {
      x: 940,
      y: 560,
      width: 300,
      height: 68,
      label: equipped ? `✓ ${t(this.language, 'lab.equipped')}` : t(this.language, 'lab.equip'),
      color: equipped ? 0x168c78 : 0x705cff,
      onPress: () => this.equipSelected(),
    });
  }

  cyclePower(direction) {
    const index = SUPERPOWERS.findIndex(({ id }) => id === this.selectedPowerId);
    const next = SUPERPOWERS[(index + direction + SUPERPOWERS.length) % SUPERPOWERS.length];
    arcadeAudio.click();
    this.scene.restart({ returnScene: this.returnScene, selectedPowerId: next.id });
  }

  selectPower(powerId) {
    if (!getSuperpower(powerId)) return;
    this.scene.restart({ returnScene: this.returnScene, selectedPowerId: powerId });
  }

  equipSelected() {
    if ((this.profile.powers[this.selectedPowerId] ?? 0) <= 0) return;
    playerProfileStore.equip(this.selectedPowerId);
    arcadeAudio.click();
    this.scene.restart({ returnScene: this.returnScene, selectedPowerId: this.selectedPowerId });
  }

  openChallenge() {
    if (this.challenge || playerProfileStore.getMathLockRemaining(Date.now()) > 0) return;
    const level = playerProfileStore.get().mathProgress.level;
    const operation = chooseMathOperation(Math.random, level);
    this.lastOperation = operation;
    const problem = generateMathProblem(operation, Math.random, level);
    const choices = generateAnswerChoices(problem);
    this.challenge = { problem, choices, status: 'answering', level, explained: false };
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const challengePanel = createCompactPanel(this, {
      x: 640,
      y: 360,
      width: 1040,
      height: 620,
      accent: 0x7ce8ff,
    });
    this.challengeObjects.push(
      this.add.rectangle(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height, 0x020711, 0.86).setOrigin(0).setDepth(200).setInteractive(),
      ...setPanelDepth(challengePanel, 201),
      this.add.text(640, 95, t(this.language, 'lab.challenge'), compactTextStyle(38, '#ffffff')).setOrigin(0.5).setDepth(202),
      (this.challengeLevelBadge = this.add.text(1130, 95, t(this.language, `lab.level.${level}`), compactTextStyle(24, '#ffdd75')).setOrigin(1, 0.5).setDepth(202)),
      this.add.text(640, 170, `${problem.expression} = ?`, compactTextStyle(72, '#ffffff')).setOrigin(0.5).setDepth(202),
      (this.challengePrompt = this.add.text(640, 240, t(this.language, 'lab.chooseAnswer'), compactTextStyle(25, '#c7d8ed')).setOrigin(0.5).setDepth(202)),
    );
    this.answerButtons = choices.map((choice, index) => {
      const button = setButtonDepth(createCompactButton(this, {
        x: 340 + index * 200,
        y: 335,
        width: 170,
        height: 92,
        label: String(choice),
        color: 0x254f78,
        onPress: () => this.answerChallenge(choice),
      }), 203);
      this.challengeObjects.push(...button.objects);
      return button;
    });
    this.challengeFeedback = this.add.text(640, 455, '', compactTextStyle(26, '#ffb7a8', {
      wordWrap: { width: 820, useAdvancedWrap: true },
    })).setOrigin(0.5).setDepth(202);
    this.challengeObjects.push(this.challengeFeedback);
    this.continueButton = setButtonDepth(createCompactButton(this, { x: 640, y: 612, width: 320, height: 68, label: t(this.language, 'lab.continue'), color: 0x2a9eb5, onPress: () => this.closeChallenge() }), 203);
    this.newProblemButton = setButtonDepth(createCompactButton(this, { x: 640, y: 612, width: 340, height: 68, label: t(this.language, 'lab.newProblem'), color: 0x5a3fe0, onPress: () => this.nextChallenge() }), 203);
    // Close sits where Continue / New problem appear once answered.
    this.closeChallengeButton = setButtonDepth(createCompactButton(this, { x: 640, y: 612, width: 320, height: 68, label: t(this.language, 'lab.close'), color: 0x39485a, onPress: () => this.closeChallenge() }), 203);
    this.continueButton.setVisible(false);
    this.newProblemButton.setVisible(false);
    this.challengeObjects.push(...this.continueButton.objects, ...this.newProblemButton.objects, ...this.closeChallengeButton.objects);
  }

  nextChallenge() {
    this.challengeObjects.forEach((object) => object.destroy());
    this.challengeObjects = [];
    this.challenge = null;
    this.scene.restart({ returnScene: this.returnScene, selectedPowerId: this.selectedPowerId, openChallenge: true });
  }

  answerChallenge(value) {
    if (!this.challenge || this.challenge.status !== 'answering') return;
    const { problem } = this.challenge;
    this.closeChallengeButton?.setVisible(false);
    const correct = isCorrectAnswer(problem, value);
    this.answerButtons.forEach((button, index) => {
      button.zone.input.enabled = false;
      const choice = this.challenge.choices[index];
      if (choice === Number(value)) button.setColor(correct ? 0x168c78 : 0xa83d50);
      // A miss also shows which choice was right.
      else if (!correct && choice === problem.answer) button.setColor(0x168c78);
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
      // The earned charge flies from the problem up to the lab's charge counter.
      this.challengeObjects.push(...playPowerRewardBurst(this, {
        fromX: 640,
        fromY: 260,
        toX: 1100,
        toY: 120,
        power,
        bonus: outcome.bonusCharge,
        bonusLabel: t(this.language, 'lab.bonusBadge'),
        onArrive: () => arcadeAudio.success(),
      }));
      this.continueButton.setVisible(true);
      return;
    }
    this.challenge.status = outcome.takeBreak ? 'locked' : 'wrong';
    this.challenge.explained = true;
    this.challengeLevelBadge?.setText(t(this.language, `lab.level.${outcome.level}`));
    this.challengeObjects.push(...renderMathExplanation(this, {
      x: 640,
      y: 430,
      problem,
      language: this.language,
      depth: 202,
      scale: 1.3,
    }));
    if (outcome.takeBreak || outcome.leveledDown) {
      const note = outcome.takeBreak ? t(this.language, 'lab.wrongCooldown') : t(this.language, 'lab.levelDown');
      // The answer prompt is done with; the note takes its line so it never
      // collides with the explanation below the answers.
      this.challengePrompt.setText(note).setColor('#ffb7a8');
    }
    arcadeAudio.impact();
    if (outcome.takeBreak) {
      this.continueButton.setVisible(true);
    } else {
      this.newProblemButton.setPosition(470, 612);
      this.continueButton.setPosition(830, 612);
      this.newProblemButton.setVisible(true);
      this.continueButton.setVisible(true);
    }
  }

  closeChallenge() {
    this.challengeObjects.forEach((object) => object.destroy());
    this.challengeObjects = [];
    this.challenge = null;
    this.scene.restart({ returnScene: this.returnScene, selectedPowerId: this.selectedPowerId });
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Customize', { tab: 'gear' });
  }

  handlePlatformBack() {
    if (this.challenge) this.closeChallenge();
    else this.back();
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    return {
      mode: 'power-lab',
      compactPhoneUi: true,
      stageLayout: this.stageLayout,
      language: this.language,
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
      actions: ['previous power', 'next power', 'solve', 'equip', 'back'],
    };
  }

  advanceForTesting() {}
}
