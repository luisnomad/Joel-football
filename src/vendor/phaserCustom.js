/**
 * Trimmed Phaser build for Joel Football (audit I1, 2026-10-08).
 *
 * The game renders with the Canvas renderer (src/main.js) and simulates with
 * Matter physics only. This entry mirrors phaser/src/phaser.js but omits the
 * namespaces the game never uses (Arcade physics, Tilemaps, the DOM element
 * plugin, the WebGL-only FX, Actions, Create, Curves) and keeps only the game
 * object types the game creates (src/vendor/phaserGameObjects.js). vite.config.js
 * serves this file as `phaser` and sets Phaser's build flags so the WebGL renderer, the
 * 3D camera / Instant Games plugins and Phaser's own sound manager (the game
 * plays audio through services/ArcadeAudio.js) are compiled out.
 *
 * Every kept module registers its own scene plugins and game-object factories
 * when it is loaded, exactly as in the full entry.
 */
import 'phaser/src/polyfills/requestVideoFrame.js';
import CONST from 'phaser/src/const.js';
import Extend from 'phaser/src/utils/object/Extend.js';
import Animations from 'phaser/src/animations/index.js';
import BlendModes from 'phaser/src/renderer/BlendModes.js';
import Cache from 'phaser/src/cache/index.js';
import Cameras from 'phaser/src/cameras/index.js';
import Core from 'phaser/src/core/index.js';
import Class from 'phaser/src/utils/Class.js';
import Data from 'phaser/src/data/index.js';
import Display from 'phaser/src/display/index.js';
import Events from 'phaser/src/events/index.js';
import Game from 'phaser/src/core/Game.js';
import GameObjects from './phaserGameObjects.js';
import Geom from 'phaser/src/geom/index.js';
import Input from 'phaser/src/input/index.js';
import Loader from 'phaser/src/loader/index.js';
import PhaserMath from 'phaser/src/math/index.js';
import Matter from 'phaser/src/physics/matter-js/index.js';
import Plugins from 'phaser/src/plugins/index.js';
import Renderer from 'phaser/src/renderer/index.js';
import Scale from 'phaser/src/scale/index.js';
import ScaleModes from 'phaser/src/renderer/ScaleModes.js';
import Scene from 'phaser/src/scene/Scene.js';
import Scenes from 'phaser/src/scene/index.js';
import Structs from 'phaser/src/structs/index.js';
import Textures from 'phaser/src/textures/index.js';
import Time from 'phaser/src/time/index.js';
import Tweens from 'phaser/src/tweens/index.js';
import Utils from 'phaser/src/utils/index.js';

const Phaser = Extend(false, {
  Animations,
  BlendModes,
  Cache,
  Cameras,
  Core,
  Class,
  Data,
  Display,
  Events,
  Game,
  GameObjects,
  Geom,
  Input,
  Loader,
  Math: PhaserMath,
  Physics: { Matter },
  Plugins,
  Renderer,
  Scale,
  ScaleModes,
  Scene,
  Scenes,
  Structs,
  Textures,
  Time,
  Tweens,
  Utils,
}, CONST);

globalThis.Phaser = Phaser;

export default Phaser;
