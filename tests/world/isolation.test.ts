import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
function files(directory:string):string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
test('world runtime never imports legacy state, initializes storage, or transmits private source links',()=>{
  const runtime=files(path.join(root,'src/world')).filter(file=>/\.(ts|tsx)$/.test(file));
  for(const file of runtime){const source=readFileSync(file,'utf8');assert.doesNotMatch(source,/\b(?:localStorage|sessionStorage|indexedDB)\s*[.(]/,file);assert.doesNotMatch(source,/from\s+['"][^'"]*(?:decision|persistence|domain|story)\//,file);assert.doesNotMatch(source,/https?:\/\/(?:docs\.google\.com|drive\.google\.com|[^/]*slack\.com)\//,file);}
  const entry=readFileSync(path.join(root,'src/world-main.tsx'),'utf8');assert.doesNotMatch(entry,/from\s+['"]\.\/App['"]|decision-entry|runtime-mode|persistence/);
});
