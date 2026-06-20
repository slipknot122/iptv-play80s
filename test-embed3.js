const { app, BrowserWindow, ipcMain } = require('electron');
const cp = require('child_process');
const path = require('path');

app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({ 
    width: 1280, height: 800, 
    frame: true, backgroundColor: '#0F1117' 
  });
  mainWindow.loadURL('data:text/html,<body style="background:black; margin:0;"><div id="vid" style="margin-top:100px; margin-left:100px; width:800px; height:500px; background:red;"></div><button style="position:absolute; top:120px; right: 400px; z-index:50;">TEST BUTTON</button></body>');
  
  setTimeout(() => {
    const mpvChildWindow = new BrowserWindow({
      parent: mainWindow,
      frame: false,
      transparent: false,
      backgroundColor: '#000000',
      hasShadow: false,
      show: false
    });
    
    const bounds = mainWindow.getContentBounds();
    mpvChildWindow.setBounds({
      x: Math.round(bounds.x + 100),
      y: Math.round(bounds.y + 100),
      width: 800,
      height: 500
    });
    mpvChildWindow.show();
    
    const handle = mpvChildWindow.getNativeWindowHandle();
    const wid = handle.length === 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));
    console.log("WID:", wid.toString());
    
    const mpvPath = path.join(__dirname, 'resources/mpv/mpv.exe');
    const mpv = cp.spawn(mpvPath, [
      'test.mp4',
      `--wid=${wid}`,
      '--vo=gpu',
      '--hwdec=auto',
      '--idle=once',
      '--keep-open=yes'
    ]);
    
    mpv.stdout.on('data', d => console.log("MPV OUT:", d.toString()));
    mpv.stderr.on('data', d => console.log("MPV ERR:", d.toString()));
  }, 2000);
});
