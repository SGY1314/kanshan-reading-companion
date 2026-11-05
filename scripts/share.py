import hashlib
import json
from pathlib import Path
import zipfile

project = Path(__file__).resolve().parent.parent
version = json.loads((project / 'package.json').read_text(encoding='utf-8'))['version']
runtime = project / 'release-v0.6' / 'Kanshan-win32-x64'
output = project.parent
archive = output / f'看山阅读伙伴-v{version}-Windows分享版.zip'
for name in ['Kanshan.exe', 'resources/app.asar', 'resources/extension/manifest.json', 'LICENSE', 'LICENSES.chromium.html']:
    if not (runtime / name).is_file():
        raise RuntimeError(f'缺少运行文件：{name}')

forbidden = {'credentials.bin', 'pairing-token', 'library.json', 'demo-profile.json', 'pet-settings.json', 'pet-motion-preferences.json'}
files = sorted(p for p in runtime.rglob('*') if p.is_file())
for p in files:
    if p.name in forbidden or p.name.startswith('.env') or p.name.startswith('credentials.unreadable-'):
        raise RuntimeError('运行目录含个人配置，停止打包')

guide = f'''看山·阅读伙伴 v{version} — Windows 64 位分享版

一、打开看山
1. 右键压缩包，选择“全部解压”，放到一个固定文件夹。
2. 双击外层的“启动看山.cmd”；也可以进入 Kanshan 文件夹双击 Kanshan.exe。
3. 桌宠出现在桌面右下角。点击桌宠，打开浏览器里的阅读伙伴。
4. 不需要安装 Node.js、Python 或开发工具。请保留 Kanshan 文件夹中的全部文件。

二、第一次使用
桌宠和本地问题记录可以先体验；知乎搜索和模型功能需要你自己的服务配置。
网页右上角“连接设置”中填写：
知乎：知乎开放平台 Access Secret。
阅读模型：API 根地址、模型名称、API Key。先保存，再点击测试连接。
知乎开放平台：https://developer.zhihu.com/profile
模型使用会按你所选服务商的规则计费。

三、安装知乎划线插件
1. Chrome 地址栏输入 chrome://extensions，或 Edge 输入 edge://extensions。
2. 打开“开发者模式”，点击“加载已解压的扩展程序”。
3. 选择本包中的 Kanshan/resources/extension 文件夹。
4. 保持桌宠运行，打开或刷新阅读伙伴网页，插件会自动连接。
5. 刷新知乎页面，选中文字即可保存金句、写批注。
如果自动连接不成功，在“连接设置”中查看状态并点击“重新连接”；主动断开后点击“恢复连接”。

四、带着问题阅读
记录问题和补充 → 去阅读找线索 → 打开知乎原文 → 插件留下金句 → 回到问题选择依据 → 生成建议。
同一问题下会保留找到的帖子、金句、补充和建议。
每条行动可以标记“准备试试／试过了／不适合”，填写感受，下一次根据反馈调整建议。
首页推荐支持“换一篇”“不感兴趣”。

五、桌宠操作
单击：打开阅读界面。按住身体：拖动。右键：动作预览、动作频率、音效、隐藏与退出。
找不到桌宠时，可从 Windows 右下角的托盘图标显示；图标可能在折叠区域里。
关闭阅读网页不会退出桌宠；需要退出时使用右键或托盘菜单。

六、数据在哪里
本包不包含分享者的 API 密钥、配对码、阅读记录或个人笔记。
收到的人需要填写自己的配置，并完成自己的插件配对。
问题、建议、反馈和历史保存在当前浏览器的本机站点存储；请继续用同一浏览器和 http://127.0.0.1:47840/，清理网站数据会清除这些记录。
插件已保存的摘录与加密凭证保存在当前 Windows 用户的应用数据目录。
桌宠退出后，本机网页服务会停止。网页地址只供收到的人在自己的电脑使用，不能当在线网址转发。

七、常见情况
启动提示端口 47840 被占用：先退出旧版看山或占用该端口的本地预览程序，再启动。
插件显示未连接：先启动桌宠，再打开阅读伙伴网页完成连接，并刷新知乎页面。
启动看山.cmd 没有反应：进入 Kanshan 文件夹直接双击 Kanshan.exe。
本包适用于 Windows 64 位；不适用于 macOS 或手机。
'''
launcher = '@echo off\r\nstart "" "%~dp0Kanshan\\Kanshan.exe"\r\n'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in files:
        if p.name == '使用说明.md':
            continue
        z.write(p, Path('Kanshan') / p.relative_to(runtime))
    z.writestr('先读我-使用说明.txt', '\ufeff' + guide)
    z.writestr('启动看山.cmd', launcher)
    z.writestr('Kanshan/使用说明.txt', '\ufeff' + guide)
with zipfile.ZipFile(archive) as z:
    bad = z.testzip()
    if bad:
        raise RuntimeError(f'压缩校验失败：{bad}')
    names = set(z.namelist())
    for name in ['启动看山.cmd', '先读我-使用说明.txt', 'Kanshan/Kanshan.exe', 'Kanshan/resources/app.asar', 'Kanshan/resources/extension/connect.js']:
        if name not in names:
            raise RuntimeError(f'压缩包缺少文件：{name}')
    if z.read('启动看山.cmd').decode('ascii') != launcher:
        raise RuntimeError('启动入口不完整')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
checksum = output / f'看山-v{version}-Windows分享版-SHA256.txt'
checksum.write_text(digest + '  ' + archive.name + '\n', encoding='utf-8')
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'files': len(names), 'sha256': digest}, ensure_ascii=False))
