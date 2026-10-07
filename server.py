# 西尔象棋盲棋 - 局域网服务器
# 作用：
#   1. 让手机通过 WiFi 访问象棋页面（和电脑同一网络）
#   2. 自带 /tts 语音代理：手机浏览器直连百度会被反爬拦截，
#      由这台电脑服务器代为转发，语音播报稳定可靠（与围棋听棋页同一方案）
import socket
import http.server
import socketserver
import urllib.request
import urllib.parse

PORT = 8010

# 获取本机非 127 的 IPv4 地址
ips = [i[4][0] for i in socket.getaddrinfo(
    socket.gethostname(), None, socket.AF_INET)
    if not i[4][0].startswith('127.')]

print('本机可访问地址（手机和电脑需要在同一个网络）：')
if ips:
    for ip in ips:
        print(f'  http://{ip}:{PORT}/')
else:
    print('  （未找到非 127 的 IPv4 地址，请检查网络连接）')
print()
print(f'正在启动服务器，端口 {PORT} ...')
print('不要关闭此窗口，手机通过上方地址访问。')
print()


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/tts?'):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            text = params.get('text', [''])[0]
            if not text:
                self.send_error(400, '缺少 text 参数')
                return
            baidu_url = ('https://fanyi.baidu.com/gettts?lan=zh&spd=5&pit=5&vol=9&per=0&text='
                         + urllib.parse.quote(text))
            try:
                req = urllib.request.Request(
                    baidu_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://fanyi.baidu.com/'
                    }
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    ctype = resp.headers.get('Content-Type', 'audio/mpeg')
                    self.send_response(200)
                    self.send_header('Content-Type', ctype)
                    self.send_header('Content-Length', str(len(data)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(data)
            except Exception as e:
                self.send_error(502, 'TTS 代理失败: ' + str(e))
            return
        super().do_GET()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
    httpd.serve_forever()
