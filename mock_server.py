from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, os
ROOT=Path(__file__).resolve().parent/'public'
os.chdir(ROOT)
class H(SimpleHTTPRequestHandler):
    def _j(self,obj,status=200):
        b=json.dumps(obj).encode(); self.send_response(status); self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path.startswith('/api/session'): return self._j({'authenticated':True,'configured':True})
        if self.path.startswith('/api/health'): return self._j({'ok':True,'version':'11.0-max','security':{'sessionConfigured':True,'confirmationConfigured':True,'cronSecretConfigured':True},'ai':{'gemini':True,'openrouter':True,'claude':False,'costMode':'free-first','paidFallbacks':False},'kv':False,'blob':False,'supabaseSnapshots':True,'comms':{'email':False,'whatsapp':False,'rcs':False}})
        if self.path.startswith('/api/meta'): return self._j({'configured':False,'data':[]})
        if self.path.startswith('/api/comms'): return self._j({'email':False,'whatsapp':False,'rcs':False,'items':[]})
        if self.path=='/' or self.path.startswith('/?'): self.path='/index.html'
        return super().do_GET()
    def do_POST(self):
        if self.path.startswith('/api/session'): return self._j({'ok':True})
        return self._j({'ok':True,'text':'{}','provider':'mock'})
    def do_DELETE(self):
        if self.path.startswith('/api/session'): return self._j({'ok':True})
        return self._j({'error':'notfound'},404)
    def log_message(self,*a): pass
if __name__=='__main__': ThreadingHTTPServer(('127.0.0.1',8765),H).serve_forever()
