export const SUPERPOWERS = Object.freeze([
  { id: 'fireball', icon: 'F', color: 0xff6b32, nameKey: 'power.fireball.name', descriptionKey: 'power.fireball.description' },
  { id: 'ice', icon: 'I', color: 0x78ddff, nameKey: 'power.ice.name', descriptionKey: 'power.ice.description' },
  { id: 'lightning', icon: '⚡', color: 0xffe45c, nameKey: 'power.lightning.name', descriptionKey: 'power.lightning.description' },
  { id: 'tornado', icon: 'T', color: 0x6ff0c7, nameKey: 'power.tornado.name', descriptionKey: 'power.tornado.description' },
  { id: 'rocket', icon: 'R', color: 0xff496f, nameKey: 'power.rocket.name', descriptionKey: 'power.rocket.description' },
  { id: 'big', icon: 'G', color: 0xffc653, nameKey: 'power.big.name', descriptionKey: 'power.big.description' },
  { id: 'boomerang', icon: '↩', color: 0xffb14a, nameKey: 'power.boomerang.name', descriptionKey: 'power.boomerang.description' },
  { id: 'warp', icon: '✦', color: 0xa78cff, nameKey: 'power.warp.name', descriptionKey: 'power.warp.description' },
  { id: 'shield', icon: '◆', color: 0x55e0ee, nameKey: 'power.shield.name', descriptionKey: 'power.shield.description' },
  { id: 'hyper', icon: '★', color: 0x8dff70, nameKey: 'power.hyper.name', descriptionKey: 'power.hyper.description' },
]);

const byId = new Map(SUPERPOWERS.map((power) => [power.id, power]));

export const getSuperpower = (id) => byId.get(id) ?? null;

const shot = (power, direction, baseSpeed, overrides = {}) => ({
  powerId: power.id,
  mechanic: power.id,
  vx: direction * baseSpeed,
  vy: -3.8,
  spin: direction * 0.24,
  color: power.color,
  ...overrides,
});

export const applySuperShot = (id, { direction = 1, baseSpeed = 23 } = {}) => {
  const power = getSuperpower(id);
  const facing = direction >= 0 ? 1 : -1;
  const speed = Math.max(1, Number(baseSpeed) || 23);
  if (!power) return { powerId: null, mechanic: 'standard', vx: facing * speed, vy: -3.8, spin: facing * 0.24, color: 0xffffff };

  switch (power.id) {
    case 'fireball':
      return shot(power, facing, speed * 1.3);
    case 'ice':
      return shot(power, facing, speed, { effect: 'freeze' });
    case 'lightning':
      return shot(power, facing, speed * 1.55, { vy: -2.4, spin: facing * 0.34 });
    case 'tornado':
      return shot(power, facing, speed * 0.95, { vy: -10, spin: facing * 0.68 });
    case 'rocket':
      return shot(power, facing, speed * 1.4, { vy: -0.8, spin: facing * 0.1 });
    case 'big':
      return shot(power, facing, speed, { effect: 'big' });
    case 'boomerang':
      return shot(power, facing, speed * 1.15, { effect: 'boomerang' });
    case 'warp':
      return shot(power, facing, speed * 1.15, { effect: 'warp' });
    case 'shield':
      return shot(power, facing, speed, { effect: 'shield' });
    case 'hyper':
      return shot(power, facing, speed, { effect: 'hyper' });
    default:
      return shot(power, facing, speed);
  }
};
