import { readFile,writeFile } from 'node:fs/promises';
import { libraryVersion } from '../src/facts.ts';
import type { Fact } from '../src/facts.ts';
const facts=JSON.parse(await readFile(new URL('../content/facts.json',import.meta.url),'utf8')) as Fact[];
await writeFile(new URL('../public/facts.json',import.meta.url),JSON.stringify({version:await libraryVersion(facts),facts},null,2)+'\n');
console.log(`Public library built: ${facts.length} records; ${facts.filter(f=>f.status==='reviewed').length} reviewed.`);
