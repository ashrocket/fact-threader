import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
const ignore=new Set(['node_modules','.git','.wrangler','test-results','dist']);
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{40,}/,/AKIA[A-Z0-9]{16}/,/sk-(?:proj-)?[A-Za-z0-9_-]{32,}/,/EA[A-Za-z0-9]{70,}/];
let failures=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(ignore.has(entry.name))continue;const path=join(dir,entry.name);if(entry.isDirectory()){await walk(path);continue;}if(entry.isSymbolicLink())throw Error(`Unexpected symlink: ${path}`);if(entry.name.startsWith('.dev.vars')||entry.name.startsWith('.env')){console.error(`Private configuration file present: ${path}`);failures++;continue;}const text=await readFile(path,'utf8');if(patterns.some(p=>p.test(text))){console.error(`Potential secret in ${path}; value suppressed`);failures++;}if(path!=='scripts/scan-secrets.mjs'&&/\/Users\/ashrocket\/|retailaer\.com/i.test(text)){console.error(`Private/local metadata in ${path}`);failures++;}}}
await walk('.');if(failures)process.exitCode=1;else console.log('Pattern and local-metadata scan passed. Review the staged diff before publication.');
