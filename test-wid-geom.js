const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({width: 800, height: 600});
  win.loadURL('https://google.com');
  setTimeout(() => {
    const handle = win.getNativeWindowHandle();
    let wid = handle.length === 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
    console.log('Spawning mpv with wid', wid.toString());
    const cp = require('child_process');
    const mpv = cp.spawn('resources\\\\mpv\\\\mpv.exe', [
      '--wid=' + wid.toString(), 
      '--geometry=400x300+100+100', 
      '--force-window=yes',
      '--input-ipc-server=\\\\\\\\.\\\\pipe\\\\test-mpv',
      '--loop', 
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    ]);
  }, 2000);
});
