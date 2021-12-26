# yws

> WebSocket Server/Client Wrapper

### Installation

```bash
$ (npm/yarn/pnpm) add yws
```

### Example

> WS server

```ts
import { Server } from "ws";

const wss = new Server({
  port: 3000,
  clientTracking: false,
  maxPayload: 64 * 1024,
});

type Incoming = {
  type: "ping";
};

type Outgoing =
  | {
      type: "acknowledgement";
      id: string;
    }
  | {
      type: "pong";
    };

wss.on("connection", (socket) => {
  const ws = wrap<Incoming, Outgoing>(socket);

  ws.commit({
    type: "acknowledgement",
    id: ws.id,
  });

  ws.onMessage(async (data) => {
    if (data.type === "ping") {
      ws.commit({
        type: "pong",
      });
    }
  });
});
```

> Fastify server

```ts
import fastify from "fastify";
import websocketPlugin from "fastify-websocket";
import { wrap } from "yws/server";

type Incoming = {
  t: "ping";
};

type Outgoing =
  | {
      t: "ack";
      id: string;
    }
  | {
      t: "pong";
    }
  | {
      t: "hello";
      f: string;
    };

export const app = fastify()
  .register(websocketPlugin)
  .route({
    url: "/",
    method: "GET",
    handler(_req, res) {
      res.send("ok");
    },
    wsHandler(connection) {
      const ws = wrap<Incoming, Outgoing>(connection);

      ws.commit({
        t: "ack",
        id: ws.id,
      });

      ws.onMessage(async (data) => {
        if (data.t === "ping") {
          ws.commit({ t: "pong" });
        }

        setTimeout(() => {
          ws.broadcast({
            t: "hello",
            f: "broadcast",
          });
        }, 5000);
      });
    },
  });

app.listen(3000);
```

> Client

```ts
import { createClient } from "yws";

type Incoming = {
  t: "pong";
};

type Outgoing =
  | {
      t: "ping";
    }
  | {
      t: "hello";
      d: string;
    };

const ws = createClient<Incoming, Outgoing>({
  url: "ws://localhost:3000",
  onMessage(data) {
    if (data.t === "pong") {
      console.log("Heartbeat successful.");
    }
  },
  heartBeat: {
    shape: {
      t: "ping",
    },
    interval: 25_000,
  },
});

ws.commit({
  t: "hello",
  d: "lorem ipsum...",
});
```
