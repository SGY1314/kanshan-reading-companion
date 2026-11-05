import {packager} from '@electron/packager';
const index = process.argv.indexOf('--electron-zip-dir');
const electronZipDir = index >= 0 ? process.argv[index+1] : undefined;
const paths = await packager({
  dir:'.',name:'Kanshan',platform:'win32',arch:'x64',electronVersion:'45.2.1',
  out:'release-v0.6',overwrite:false,asar:true,prune:true,icon:'ui/icon.ico',extraResource:['extension'],
  electronZipDir,
  ignore:[/^\/(?:release(?:-v[0-9.]+)?|tests|work|docs|scripts|\.github)(?:\/|$)/,/^\/README\.md$/,/^\/打开看山\.cmd$/],
  win32metadata:{CompanyName:'SGY1314',FileDescription:'看山·阅读伙伴',ProductName:'看山·阅读伙伴'}
});
for (const output of paths) console.log(output);
