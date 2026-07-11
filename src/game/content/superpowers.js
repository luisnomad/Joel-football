export const SUPERPOWERS = Object.freeze([
  { id: 'fireball', activation: 'shot', icon: 'F', color: 0xff6b32, nameKey: 'power.fireball.name', descriptionKey: 'power.fireball.description' },
  { id: 'ice', activation: 'instant', icon: 'I', color: 0x78ddff, nameKey: 'power.ice.name', descriptionKey: 'power.ice.description', activationKey: 'power.ice.activation' },
  { id: 'big', activation: 'shot', icon: 'G', color: 0xffc653, nameKey: 'power.big.name', descriptionKey: 'power.big.description' },
  { id: 'shield', activation: 'instant', icon: '◆', color: 0x55e0ee, nameKey: 'power.shield.name', descriptionKey: 'power.shield.description', activationKey: 'power.shield.activation' },
  { id: 'hyper', activation: 'instant', icon: '★', color: 0x8dff70, nameKey: 'power.hyper.name', descriptionKey: 'power.hyper.description', activationKey: 'power.hyper.activation' },
]);

const byId = new Map(SUPERPOWERS.map((power) => [power.id, power]));

export const getSuperpower = (id) => byId.get(id) ?? null;

export const isInstantSuperpower = (id) => getSuperpower(id)?.activation === 'instant';

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
    case 'big':
      return shot(power, facing, speed, { effect: 'big' });
    default:
      return shot(power, facing, speed);
  }
};
