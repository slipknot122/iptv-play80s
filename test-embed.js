const { app, BrowserWindow } = require('electron');
const cp = require('child_process');

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({ width: 800, height: 600 });
  mainWindow.loadURL('data:text/html,<body style="background:red;"><h1>Main Window</h1></body>');
  
  setTimeout(() => {
    const mpvChildWindow = new BrowserWindow({
      parent: mainWindow,
      frame: false,
      transparent: false,
      backgroundColor: '#000000',
      hasShadow: false,
      show: true
    });
    
    mpvChildWindow.setBounds({ x: 100, y: 100, width: 400, height: 300 });

    const handle = mpvChildWindow.getNativeWindowHandle();
    const wid = handle.length === 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
    
    console.log('WID:', wid.toString());

    const mpv = cp.spawn('resources/mpv/mpv.exe', [
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      '--wid=' + wid.toString(),
      '--no-border',
      '--idle=once',
      '--force-window=yes'
    ]);

    mpv.stdout.on('data', d => console.log('MPV OUT:', d.toString()));
    mpv.stderr.on('data', d => console.log('MPV ERR:', d.toString()));
    
  }, 1000);
});
