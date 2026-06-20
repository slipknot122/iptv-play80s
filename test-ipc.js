const { spawn } = require('child_process');
const net = require('net');

const pipeName = '\\\\.\\pipe\\iptv_test_pipe_' + Date.now();

console.log('Pipe name:', pipeName);

const args = [
  '--no-terminal',
  '--idle=yes',
  `--input-ipc-server=${pipeName}`
];

const mpvProcess = spawn('resources\\mpv\\mpv.exe', args, {
  detached: false,
  stdio: ['ignore', 'pipe', 'pipe']
});

mpvProcess.stdout.on('data', d => console.log('OUT:', d.toString()));
mpvProcess.stderr.on('data', d => console.log('ERR:', d.toString()));
mpvProcess.on('exit', c => console.log('EXIT:', c));

setTimeout(() => {
  console.log('Attempting to connect to', pipeName);
  const client = net.createConnection(pipeName);
  client.on('connect', () => {
    console.log('SUCCESSFULLY CONNECTED TO IPC!');
    client.destroy();
    mpvProcess.kill();
  });
  client.on('error', (err) => {
    console.error('FAILED TO CONNECT:', err);
    mpvProcess.kill();
  });
}, 1000);
