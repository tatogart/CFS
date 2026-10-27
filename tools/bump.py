# Обновляет версию файлов (сброс кэша браузера) и список офлайн-кэша в sw.js.
# Запуск из корня репозитория: python3 tools/bump.py
import re, glob, time
v = str(int(time.time()))
for f in glob.glob('js/*.js'):
    s = open(f).read()
    s = re.sub(r"(from '\./[a-z0-9]+\.js)\?v=\d+'", lambda m: m.group(1) + "?v=" + v + "'", s)
    open(f, 'w').write(s)
s = open('index.html').read()
s = re.sub(r'js/main\.js\?v=\d+"', 'js/main.js?v=' + v + '"', s)
s = re.sub(r'css/style\.css\?v=\d+"', 'css/style.css?v=' + v + '"', s)
open('index.html', 'w').write(s)
files = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'vendor/three.module.min.js', 'css/style.css?v=' + v]
files += sorted('js/' + f.split('/')[-1] + '?v=' + v for f in glob.glob('js/*.js'))
s = open('sw.js').read()
s = re.sub(r"const VERSION = '[^']*';", "const VERSION = '" + v + "';", s)
s = re.sub(r"const FILES = \[[^\]]*\];", "const FILES = " + repr(files).replace("'", '"') + ";", s)
open('sw.js', 'w').write(s)
print('version', v)
