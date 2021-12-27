import WebSocket from "isomorphic-ws";
import type { CloseEvent, ErrorEvent } from "ws";

export type Options<Incoming, Outgoing> = {
  url: string;
  onMessage?: (data: Incoming) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: ErrorEvent) => void;
  reconnectDelay?: number;
  heartBeat?: {
    interval: number;
    shape: Outgoing;
  };
};

export function createClient<Incoming, Outgoing>({
  url,
  onMessage,
  onClose,
  onError,
  heartBeat,
  reconnectDelay,
}: Options<Incoming, Outgoing>) {
  let ws: WebSocket;
  let buffer: string[] = [];
  let messagesReceived = 0;
  let heartBeatInterval: NodeJS.Timeout;
  let shouldReconnect = true;

  function reconnect() {
    const socket = new WebSocket(url);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        messagesReceived++;
        onMessage?.(data);
      } catch {}
    };

    socket.onclose = (event) => {
      if (heartBeatInterval) {
        clearInterval(heartBeatInterval);
      }
      onClose?.(event);
      if (shouldReconnect) {
        setTimeout(() => {
          reconnect();
        }, reconnectDelay ?? 2500);
      }
    };

    socket.onerror = (event) => {
      onError?.(event);
    };

    if (heartBeat) {
      heartBeatInterval = setInterval(() => {
        socket.send(JSON.stringify(heartBeat.shape));
      }, heartBeat.interval);
    }

    ws = socket;
  }

  reconnect();

  return {
    getRaw() {
      return ws;
    },
    getBuffer() {
      return buffer;
    },
    messagesCount() {
      return messagesReceived;
    },
    commit(data: Outgoing) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      } else {
        buffer.push(message);
      }
    },
    close(disableReconnect = false) {
      ws.close();
      if (disableReconnect) {
        shouldReconnect = false;
      }
    },
  };
}
