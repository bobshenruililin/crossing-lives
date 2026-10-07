import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraFor, PLANE, screenToPlane } from '../../src/world/geometry';
import { getScene } from '../../src/world/scene-registry';
import { SCENE_IDS } from '../../src/world/types';
test('shared camera covers all target viewports and round-trips feet without prop drift', () => {
  for (const viewport of [{width:360,height:800},{width:390,height:844},{width:1440,height:900}]) {
    for (const id of SCENE_IDS) {
      const scene=getScene(id), camera=cameraFor(viewport.width,viewport.height,scene.playerStart);
      assert.ok(camera.width>=viewport.width);assert.ok(camera.height>=viewport.height);
      assert.ok(camera.left<=0&&camera.left+camera.width>=viewport.width);
      const projected={x:camera.left+scene.playerStart.x*camera.scale,y:camera.top+scene.playerStart.y*camera.scale};
      const source=screenToPlane(projected,camera);
      assert.ok(Math.abs(source.x-scene.playerStart.x)<.001);assert.ok(Math.abs(source.y-scene.playerStart.y)<.001);
      assert.ok(scene.playerBodyHeight>0&&scene.playerBodyHeight<PLANE.height*.6);
    }
  }
});
test('points fit the primary thought limit, are distinct, and every anchor shares the source plane', () => {
  const interactions=new Set();
  for(const id of SCENE_IDS){const scene=getScene(id);for(const point of scene.points){assert.ok(point.thought.trim().split(/\s+/).length<=35);interactions.add(point.interactionId);}for(const point of [...scene.points,...scene.exits,scene.playerStart]){assert.ok(point.x>=0&&point.x<=PLANE.width);assert.ok(point.y>=0&&point.y<=PLANE.height);}}
  assert.equal(interactions.size,12);
});
test('a partly cropped 44px marker is distinguishable from a fully visible or fully offscreen marker', async () => {
  const { partiallyCropped } = await import('../../src/world/geometry');
  const camera = cameraFor(1440, 900, { x: 267.52, y: 785.735 });
  const size = { width: 1440, height: 900 };
  assert.equal(partiallyCropped({ x: 1524.864, y: 785.735 }, camera, size), true);
  assert.equal(partiallyCropped({ x: 836, y: 470 }, camera, size), false);
  assert.equal(partiallyCropped({ x: 1800, y: 785 }, camera, size), false);
});
test('portrait home frames people with the door when it fits and keeps the whole family when it cannot', () => {
  const scene = getScene('hk-home');
  for(const width of [360,390]) for(const family of [false,true]) {
    const hero=scene.playerStart, friend={x:hero.x-scene.playerBodyHeight*.42,y:hero.y-6};
    const child={x:hero.x-scene.playerBodyHeight*.42*1.8,y:hero.y+4};
    const door=scene.exits[0].doorAnchor!;
    const childRadius=scene.playerBodyHeight*.67*.165;
    const anchors=[{x:hero.x-scene.playerBodyHeight*.18,y:hero.y},{x:hero.x+scene.playerBodyHeight*.18,y:hero.y},{x:friend.x-scene.playerBodyHeight*.18,y:friend.y},{x:friend.x+scene.playerBodyHeight*.18,y:friend.y},...(family?[{x:child.x-childRadius,y:child.y},{x:child.x+childRadius,y:child.y}]:[]),door];
    const center={x:(hero.x+(family?child.x:friend.x))/2,y:hero.y};
    const camera=cameraFor(width,844,center,anchors);
    assert.equal(camera.scale,844/941);
    if(!family) for(const point of anchors){const x=camera.left+point.x*camera.scale;assert.ok(x>=25&&x<=width-25,`home focus ${x} at ${width}`);}
    else {
      assert.equal(camera.left,cameraFor(width,844,center).left,'A door cannot push a family member offscreen when the whole group cannot fit with it.');
      const childLeft=camera.left+(child.x-childRadius)*camera.scale, childRight=camera.left+(child.x+childRadius)*camera.scale;
      assert.ok(childLeft>=0&&childRight<=width,`child body ${childLeft}..${childRight} at ${width}`);
      const heroRight=camera.left+(hero.x+(391-330)/534*scene.playerBodyHeight)*camera.scale;
      assert.ok(heroRight<=width,'The measured player body also fits in the fallback framing.');
    }
  }
});
test('returning focus to the inspected clock can keep the nearby pair and clock in the portrait view', () => {
  const scene=getScene('hk-home'), clock=scene.points[0], hero=clock.approach!;
  const friend={x:hero.x-scene.playerBodyHeight*.42,y:hero.y-6};
  const anchors=[{x:hero.x-scene.playerBodyHeight*.18,y:hero.y},{x:hero.x+scene.playerBodyHeight*.18,y:hero.y},{x:friend.x-scene.playerBodyHeight*.18,y:friend.y},{x:friend.x+scene.playerBodyHeight*.18,y:friend.y},clock];
  const camera=cameraFor(360,844,clock,anchors);
  for(const point of anchors){const x=camera.left+point.x*camera.scale;assert.ok(x>=25&&x<=335);}
});
