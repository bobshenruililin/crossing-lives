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
