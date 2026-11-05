const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        autoHideMenuBar: true, // إخفاء القوائم الافتراضية للظهور كتطبيق متكامل
        icon: path.join(__dirname, 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
