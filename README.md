# yws

> WebSocket Server library built with uWebSockets and Zod

> **Warning**
> Yws is currently under development

## Installation

```bash
$ (pnpm/yarn/npm) add yws@next
```

## Usage

#### Define Messages

```ts
import { z } from "zod";

export const clientMessages = z.object({
  t: z.literal("ping"),
});

export const serverMessages = z.union([
  z.object({
    t: z.literal("pong"),
  }),
  z.object({
    t: z.literal("randomNumber"),
    p: z.number(),
  }),
]);
```

### Server

```ts
import Server from "yws/server";
import { clientMessages, serverMessages } from "./messages";

const server = Server({
  matchEventsOn: "t",
  incoming: clientMessages,
  outgoing: serverMessages,
  // port: Number(process.env.PORT ?? 3420),
});

server.on("open", (socket) => {
  socket.subscribe("messageEvery100ms");
});

server.on("ping", (socket, data) => {
  socket.send({ t: "pong" });
});

server.on("invalidPayload", (socket, payload) => {
  console.log("Invalid Payload", payload);
});

setInterval(() => {
  server.publish("messageEvery100ms", {
    t: "pong",
  });
}, 100);
```

### Client

```ts
import Client from "yws/client";
import { clientMessages, serverMessages } from "./messages";

const client = Client({
  url: "ws://127.0.0.1:3420",
  matchEventsOn: "t",
  incoming: serverMessages,
  outgoing: clientMessages,
});

client.on("open", (event) => {
  console.log("[WS] Opened", event);
});

client.on("close", (event) => {
  console.log("[WS] Closed", event.code, event.reason);
});

client.on("message", (message) => {
  console.log("[WS] Message", message);
});
```
