"""Servidor descartável do protótipo visual. Não usar em produção."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial


ROOT = Path(__file__).resolve().parent
PORT = 4173


if __name__ == "__main__":
    handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    print(f"Protótipo disponível em http://127.0.0.1:{PORT}/?surface=captura")
    print(f"No celular, use http://IP-DO-NOTEBOOK:{PORT}/?surface=captura")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
