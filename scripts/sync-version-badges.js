#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const webVersion = pkg.version;

function marketingVersion(pbxprojPath) {
  const text = readFileSync(pbxprojPath, 'utf8');
  const match = text.match(/MARKETING_VERSION = ([\d.]+);/);
  return match ? match[1] : null;
}

const iosVersion = marketingVersion('ios/Epiphany.xcodeproj/project.pbxproj');
const macosVersion = marketingVersion('macos/Epiphany.xcodeproj/project.pbxproj');

let readme = readFileSync('README.md', 'utf8');
readme = readme
  .replace(/web-v[\d.]+-blue/, `web-v${webVersion}-blue`)
  .replace(/iOS-v[\d.]+-blue/, `iOS-v${iosVersion}-blue`)
  .replace(/macOS-v[\d.]+-blue/, `macOS-v${macosVersion}-blue`);

writeFileSync('README.md', readme);
