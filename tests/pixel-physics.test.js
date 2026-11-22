const {test} = require('node:test');
const assert = require('node:assert/strict');
const {hitsSprite,reflectWall} = require('../src/logic');
test('los huecos entre púas dejan pasar y las puntas registran contacto', () => {
  const teeth=['####','#...','####'];
  assert.equal(hitsSprite(teeth,16,6,1,0,0,20,12),false);
  assert.equal(hitsSprite(teeth,16,2,1,0,0,20,12),true);
  assert.equal(hitsSprite(teeth,16,4.5,1,0,0,20,12),true);
});
test('el rebote conserva velocidad y el desplazamiento que sobra al tocar la pared', () => {
  const b={x:315,vx:150,r:12};
  assert.ok(reflectWall(b,36,324));
  assert.deepEqual(b,{x:309,vx:-150,r:12});
  assert.equal(reflectWall(b,36,324),false);
  b.x=46;
  assert.ok(reflectWall(b,36,324));
  assert.deepEqual(b,{x:50,vx:150,r:12});
});
