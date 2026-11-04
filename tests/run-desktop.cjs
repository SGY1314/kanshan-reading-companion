const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'kanshan-desktop-'));
const child = spawn(require('electron'),[path.join(__dirname,'desktop.cjs')],{env:{...process.env,KANSHAN_DESKTOP_TEST_DIR:dir},stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('close',code=>{
  fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:100});
  process.exitCode=code || 0;
});
