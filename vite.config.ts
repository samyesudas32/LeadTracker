import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function silenceHmrPlugin(): Plugin {
  return {
    name: 'vite-silence-hmr-plugin',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            injectTo: 'head-prepend',
            children: `
              (function () {
                if (window.__silenceHmrInstalled) return;
                window.__silenceHmrInstalled = true;
                var origError = console.error;
                console.error = function () {
                  var args = Array.prototype.slice.call(arguments);
                  var text = args.map(function (a) {
                    return (a && (a.message || a.stack)) ? (a.message + ' ' + a.stack) : String(a);
                  }).join(' ');
                  if (text.indexOf('WebSocket') !== -1 || text.indexOf('failed to connect to websocket') !== -1 || text.indexOf('[vite]') !== -1) {
                    return;
                  }
                  return origError.apply(console, args);
                };

                var origWarn = console.warn;
                console.warn = function () {
                  var args = Array.prototype.slice.call(arguments);
                  var text = args.map(function (a) {
                    return (a && (a.message || a.stack)) ? (a.message + ' ' + a.stack) : String(a);
                  }).join(' ');
                  if (text.indexOf('WebSocket') !== -1 || text.indexOf('failed to connect to websocket') !== -1 || text.indexOf('[vite]') !== -1) {
                    return;
                  }
                  return origWarn.apply(console, args);
                };

                window.addEventListener('error', function (e) {
                  var msg = (e && (e.message || (e.error && e.error.message))) || '';
                  if (msg.indexOf('WebSocket') !== -1 || msg.indexOf('failed to connect to websocket') !== -1 || msg.indexOf('[vite]') !== -1) {
                    e.stopImmediatePropagation();
                    if (e.preventDefault) e.preventDefault();
                    return true;
                  }
                }, true);

                window.addEventListener('unhandledrejection', function (e) {
                  var reason = (e && e.reason) ? String(e.reason.message || e.reason) : '';
                  if (reason.indexOf('WebSocket') !== -1 || reason.indexOf('failed to connect to websocket') !== -1 || reason.indexOf('[vite]') !== -1) {
                    e.stopImmediatePropagation();
                    if (e.preventDefault) e.preventDefault();
                    return true;
                  }
                }, true);

                if (typeof window !== 'undefined' && window.WebSocket) {
                  var RealWebSocket = window.WebSocket;
                  function MockViteHmrSocket(url, protocols) {
                    var isViteHmr = false;
                    if (protocols) {
                      if (Array.isArray(protocols)) {
                        isViteHmr = protocols.indexOf('vite-hmr') !== -1;
                      } else if (typeof protocols === 'string') {
                        isViteHmr = protocols.indexOf('vite-hmr') !== -1;
                      }
                    }
                    if (typeof url === 'string' && (url.indexOf('vite') !== -1 || url.indexOf('/@vite') !== -1)) {
                      isViteHmr = true;
                    }

                    if (isViteHmr) {
                      var target = new EventTarget();
                      target.url = String(url);
                      target.protocol = 'vite-hmr';
                      target.readyState = 1;
                      target.bufferedAmount = 0;
                      target.binaryType = 'blob';
                      target.extensions = '';
                      target.send = function () {};
                      target.close = function () { target.readyState = 3; };
                      target.onopen = null;
                      target.onclose = null;
                      target.onerror = null;
                      target.onmessage = null;

                      setTimeout(function () {
                        var openEv = new Event('open');
                        if (typeof target.onopen === 'function') {
                          try { target.onopen(openEv); } catch (_) {}
                        }
                        try { target.dispatchEvent(openEv); } catch (_) {}
                      }, 10);

                      return target;
                    }

                    return new RealWebSocket(url, protocols);
                  }

                  MockViteHmrSocket.prototype = RealWebSocket.prototype;
                  MockViteHmrSocket.CONNECTING = 0;
                  MockViteHmrSocket.OPEN = 1;
                  MockViteHmrSocket.CLOSING = 2;
                  MockViteHmrSocket.CLOSED = 3;
                  window.WebSocket = MockViteHmrSocket;
                }
              })();
            `,
          },
        ];
      },
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [silenceHmrPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
