// README badges from the real versions: web from package.json, iOS from ios/project.yml.
// Runs on every `npm version` (package.json "version" script), so the badges can't go stale.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const web = JSON.parse(readFileSync('package.json', 'utf8')).version;
const yml = (p) => existsSync(p) ? (readFileSync(p, 'utf8').match(/MARKETING_VERSION:\s*"?([\d.]+)/) || [])[1] : null;
const ios = yml('ios/project.yml') || web;
const mac = yml('macos/project.yml') || web;

const readme = readFileSync('README.md', 'utf8')
  .replace(/web-v[\d.]+-blue/, `web-v${web}-blue`)
  .replace(/iOS-v[\d.]+-blue/, `iOS-v${ios}-blue`)
  .replace(/macOS-v[\d.]+-blue/, `macOS-v${mac}-blue`);
writeFileSync('README.md', readme);
console.log(`badges: web ${web}, iOS ${ios}, macOS ${mac}`);
