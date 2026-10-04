import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const sourcePath = 'scripts/apply-motion.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');
source = source.replace("mark.style.setProperty('--mark-y',\\`${8+(active+progress)*step}px\\`);", "mark.style.setProperty('--mark-y',(8+(active+progress)*step)+'px');");
source = source.replace("mark.style.setProperty('--mark-r',\\`${active*90}deg\\`);", "mark.style.setProperty('--mark-r',(active*90)+'deg');");
const tmp = '/tmp/apply-motion-fixed.mjs';
fs.writeFileSync(tmp, source);
await import(pathToFileURL(tmp).href);
