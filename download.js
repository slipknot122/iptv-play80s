const fs = require('fs');
const https = require('https');
const path = require('path');
const execSync = require('child_process').execSync;

const url = 'https://sourceforge.net/projects/mpv-player-windows/files/64bit/mpv-x86_64-20240331-git-1f25e98.7z/download';
const outDir = path.join(__dirname, 'resources', 'mpv');
const archivePath = path.join(__dirname, 'mpv.7z');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Downloading mpv...');
execSync(`curl -L -o "${archivePath}" "${url}"`, { stdio: 'inherit' });

console.log('Extracting mpv...');
execSync(`7z e "${archivePath}" -o"${outDir}" mpv.exe`, { stdio: 'inherit' });

fs.unlinkSync(archivePath);
console.log('Done!');
