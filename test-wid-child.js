const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({width: 800, height: 600, backgroundColor: '#ffffff'});
  win.loadURL('https://google.com');
  setTimeout(() => {
    const childWin = new BrowserWindow({
      parent: win,
      width: 400,
      height: 300,
      x: win.getBounds().x + 50,
      y: win.getBounds().y + 50,
      frame: false,
      transparent: false,
      backgroundColor: '#000000',
      hasShadow: false
    });
    
    // Attempt to keep it relatively positioned (Electron doesn't do this automatically for owned windows)
    win.on('move', () => {
       const pb = win.getBounds();
       childWin.setBounds({x: pb.x + 50, y: pb.y + 50, width: 400, height: 300});
    });
    
    const handle = childWin.getNativeWindowHandle();
    let wid = handle.length === 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
    console.log('Spawning mpv with wid', wid.toString());
    const cp = require('child_process');
    cp.spawn('resources\\\\mpv\\\\mpv.exe', [
      '--wid=' + wid.toString(), 
      '--loop', 
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    ]);
  }, 2000);
});
