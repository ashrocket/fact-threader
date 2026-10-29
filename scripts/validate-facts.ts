import { readFile } from 'node:fs/promises';
import { validateFacts } from '../src/facts.ts';
import type { Fact } from '../src/facts.ts';
const raw=JSON.parse(await readFile(new URL('../content/facts.json',import.meta.url),'utf8'));
const errors=validateFacts(raw);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else {const facts=raw as Fact[];console.log(`Valid structure: ${facts.length} records, ${facts.filter(f=>f.status==='reviewed').length}/100 launch-ready. Source truth requires human review.`);}
