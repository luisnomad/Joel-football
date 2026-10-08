/**
 * The Phaser game objects Joel Football uses (see src/vendor/phaserCustom.js).
 * Mirrors phaser/src/gameobjects/index.js, keeping only the core classes and
 * the object types the game creates: scene.add.{text, rectangle, circle,
 * graphics, image, zone, sprite, container, arc, ellipse}, scene.make.graphics
 * and the Matter image/sprite wrappers. The Factory/Creator modules export
 * nothing: importing them registers `scene.add.*` / `scene.make.*`. Add the
 * matching pair here before using any other game object type.
 */
import Events from 'phaser/src/gameobjects/events/index.js';
import DisplayList from 'phaser/src/gameobjects/DisplayList.js';
import GameObjectCreator from 'phaser/src/gameobjects/GameObjectCreator.js';
import GameObjectFactory from 'phaser/src/gameobjects/GameObjectFactory.js';
import UpdateList from 'phaser/src/gameobjects/UpdateList.js';
import Components from 'phaser/src/gameobjects/components/index.js';
import GetCalcMatrix from 'phaser/src/gameobjects/GetCalcMatrix.js';
import BuildGameObject from 'phaser/src/gameobjects/BuildGameObject.js';
import BuildGameObjectAnimation from 'phaser/src/gameobjects/BuildGameObjectAnimation.js';
import GameObject from 'phaser/src/gameobjects/GameObject.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import Graphics from 'phaser/src/gameobjects/graphics/Graphics.js';
import Image from 'phaser/src/gameobjects/image/Image.js';
import Sprite from 'phaser/src/gameobjects/sprite/Sprite.js';
import Text from 'phaser/src/gameobjects/text/Text.js';
import GetTextSize from 'phaser/src/gameobjects/text/GetTextSize.js';
import MeasureText from 'phaser/src/gameobjects/text/MeasureText.js';
import TextStyle from 'phaser/src/gameobjects/text/TextStyle.js';
import Zone from 'phaser/src/gameobjects/zone/Zone.js';
import Shape from 'phaser/src/gameobjects/shape/Shape.js';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc.js';
import Ellipse from 'phaser/src/gameobjects/shape/ellipse/Ellipse.js';
import Rectangle from 'phaser/src/gameobjects/shape/rectangle/Rectangle.js';
import 'phaser/src/gameobjects/container/ContainerFactory.js';
import 'phaser/src/gameobjects/graphics/GraphicsFactory.js';
import 'phaser/src/gameobjects/image/ImageFactory.js';
import 'phaser/src/gameobjects/sprite/SpriteFactory.js';
import 'phaser/src/gameobjects/text/TextFactory.js';
import 'phaser/src/gameobjects/zone/ZoneFactory.js';
import 'phaser/src/gameobjects/shape/arc/ArcFactory.js';
import 'phaser/src/gameobjects/shape/ellipse/EllipseFactory.js';
import 'phaser/src/gameobjects/shape/rectangle/RectangleFactory.js';
import 'phaser/src/gameobjects/container/ContainerCreator.js';
import 'phaser/src/gameobjects/graphics/GraphicsCreator.js';
import 'phaser/src/gameobjects/image/ImageCreator.js';
import 'phaser/src/gameobjects/sprite/SpriteCreator.js';
import 'phaser/src/gameobjects/text/TextCreator.js';
import 'phaser/src/gameobjects/zone/ZoneCreator.js';

export default {
  Events,
  DisplayList,
  GameObjectCreator,
  GameObjectFactory,
  UpdateList,
  Components,
  GetCalcMatrix,
  BuildGameObject,
  BuildGameObjectAnimation,
  GameObject,
  Container,
  Graphics,
  Image,
  Sprite,
  Text,
  GetTextSize,
  MeasureText,
  TextStyle,
  Zone,
  Shape,
  Arc,
  Ellipse,
  Rectangle,
};
