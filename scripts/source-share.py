import hashlib
import json
from pathlib import Path
import zipfile

project = Path(__file__).resolve().parent.parent
version = json.loads((project / 'package.json').read_text(encoding='utf-8'))['version']
archive = project.parent / f'看山-v{version}-开发源码交接包.zip'
allowed_files = {'package.json', 'package-lock.json', 'README.md', '.gitignore', '.gitattributes', '打开看山.cmd'}
allowed_docs = {'开发交接.md', 'pet-provenance.json', 'pet-actions.json', 'penguin-image-prompt.txt'}
files = []
for p in project.iterdir():
    if p.is_file() and (p.name in allowed_files or p.suffix in {'.cjs', '.mjs'}):
        files.append(p)
for folder in ['ui', 'extension', 'tests', 'scripts', '.github']:
    files.extend(p for p in (project / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
files.extend(project / 'docs' / name for name in allowed_docs)
for p in files:
    if not p.is_file():
        raise RuntimeError(f'交接文件不存在：{p.name}')
    if p.name.startswith('.env') or p.name in {'credentials.bin', 'pairing-token', 'library.json', 'demo-profile.json'}:
        raise RuntimeError('检测到个人配置，停止打包')

notice = '''这是看山的开发源码包，不是双击即用的桌宠安装包。

解压后，在 Kanshan-source 文件夹打开终端：
1. 安装 Node.js 22.19.0 或更高版本。
2. 执行 npm ci。
3. 执行 npm start。

先阅读 Kanshan-source/docs/开发交接.md，其中包含文件导航、当前功能、设计约束、存储结构、测试、打包方法，以及动画尚未获认可的现状。
知乎搜索和模型需要开发者填写自己的凭证。
此包包含当前全部源码修改，未包含 node_modules、构建产物、Git 历史或个人运行数据。
'''
manifest = {}
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in sorted(set(files)):
        relative = p.relative_to(project).as_posix()
        data = p.read_bytes()
        manifest[relative] = hashlib.sha256(data).hexdigest()
        z.writestr('Kanshan-source/' + relative, data)
    z.writestr('先读我-开发接手.txt', '\ufeff' + notice)
    z.writestr('源码校验清单.json', json.dumps(manifest, ensure_ascii=False, indent=2))
with zipfile.ZipFile(archive) as z:
    if z.testzip():
        raise RuntimeError('ZIP 完整性校验失败')
    for name, digest in manifest.items():
        if hashlib.sha256(z.read('Kanshan-source/' + name)).hexdigest() != digest:
            raise RuntimeError(f'源码校验失败：{name}')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.sha256.txt').write_text(digest + '  ' + archive.name + '\n', encoding='utf-8')
print(json.dumps({'archive': str(archive), 'files': len(manifest), 'bytes': archive.stat().st_size, 'sha256': digest}, ensure_ascii=False))
