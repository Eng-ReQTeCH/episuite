import { useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.DEV
  ? `ws://${location.hostname}:3001/api/v1/live`
  : `ws://${location.host}/api/v1/live`;

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  useEffect(() => {
    function connect() {
      ws.current = new WebSocket(WS_URL);
      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMsgRef.current?.(data);
        } catch {}
      };
      ws.current.onclose = () => setTimeout(connect, 3000);
    }
    connect();
    return () => ws.current?.close();
  }, []);

  const send = useCallback((msg) => {
    ws.current?.send(JSON.stringify(msg));
  }, []);

  return { send };
}
