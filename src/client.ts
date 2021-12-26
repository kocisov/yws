import WebSocket from "isomorphic-ws";

type Options<Incoming, Outgoing> = {
  url: string;
  onMessage?: (data: Incoming) => void;
  reconnectDelay?: number;
  heartBeat?: {
    interval: number;
    shape: Outgoing;
  };
};

export function createClient<Incoming, Outgoing>({
  url,
  onMessage,
  heartBeat,
  reconnectDelay,
}: Options<Incoming, Outgoing>) {
  let heartBeatInterval: NodeJS.Timeout;
  let ws: WebSocket;
  let shouldReconnect = true;

  function reconnect() {
    const socket = new WebSocket(url);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        onMessage?.(data);
      } catch {}
    };

    socket.onclose = () => {
      if (heartBeatInterval) {
        clearInterval(heartBeatInterval);
      }
      if (shouldReconnect) {
        setTimeout(() => {
          reconnect();
        }, reconnectDelay ?? 2500);
      }
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
    commit(data: Outgoing) {
      if (ws.readyState === ws.OPEN) {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
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
