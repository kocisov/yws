import EventEmitter from "eventemitter3";
import type { WebSocket } from "uWebSockets.js";
import { App } from "uWebSockets.js";
import { z } from "zod";
import type {
  DataFromDefaultEvent,
  DefaultEvents,
  ServerOptions,
  YwsServerWebSocket,
} from "./types";

export default function Server<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  M extends keyof z.infer<I>
>({ matchEventsOn, incoming, outgoing, port }: ServerOptions<I, O>) {
  const events = new EventEmitter();
  const decoder = new TextDecoder("utf-8");

  port = Number(port ?? 3420);

  const instance = App()
    .ws("/*", {
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 32,
      maxBackpressure: 1024 * 1024,

      open(ws) {
        events.emit("open", getWebSocket(ws), {
          at: Date.now(),
        });
      },

      close(ws, code, reason) {
        events.emit("close", getWebSocket(ws), {
          at: Date.now(),
          code,
          reason,
        });
      },

      message(ws, message, isBinary) {
        if (isBinary) {
          ws.end(1003);
          return;
        }

        const raw = decoder.decode(message);

        try {
          let data: any;
          const json = JSON.parse(raw);

          if (incoming) {
            const parsed = incoming.safeParse(json);

            if (parsed.success) {
              data = parsed.data;
            } else {
              events.emit("invalidPayload", getWebSocket(ws), {
                at: Date.now(),
                type: "incoming",
                data: json,
              });
              return;
            }
          }

          events.emit("message", getWebSocket(ws), data);
          events.emit(data[matchEventsOn], getWebSocket(ws), data);
        } catch (error) {
          events.emit("error", getWebSocket(ws), {
            ...(error as Error),
            at: Date.now(),
          });
        }
      },
    })

    .any("/*", (res, req) => {
      res.end("Yws v0.1.0");
    })

    .listen("0.0.0.0", port, (token) => {
      if (token) {
        console.log(`Listening on port ${port}`);
      } else {
        console.log(`Failed to listen to port ${port}`);
      }
    });

  function getWebSocket(ws: WebSocket): YwsServerWebSocket<O> {
    return {
      publish(topic, data) {
        return ws.publish(
          topic,
          typeof data === "string" ? data : JSON.stringify(data),
          false
        );
      },
      close(code, reason) {
        return ws.end(code, reason);
      },
      subscribe(topic) {
        return ws.subscribe(topic);
      },
      unsubscribe(topic) {
        return ws.unsubscribe(topic);
      },
      getSubscriptions() {
        return ws.getTopics();
      },
      send(data) {
        if (outgoing) {
          const parsed = outgoing.safeParse(data);
          if (parsed.success) {
            return ws.send(JSON.stringify(parsed.data), false);
          }
          events.emit("invalidPayload", getWebSocket(ws), {
            at: Date.now(),
            type: "outgoing",
            data,
          });
          return 0;
        }
        return ws.send(
          typeof data === "string" ? data : JSON.stringify(data),
          false
        );
      },
    };
  }

  return {
    publish(topic: string, message: z.infer<O>) {
      if (outgoing) {
        const parsed = outgoing.safeParse(message);
        if (parsed.success) {
          return instance.publish(topic, JSON.stringify(parsed.data), false);
        }
        events.emit("invalidPayload", null, {
          at: Date.now(),
          type: "outgoing",
          data: message,
        });
        return;
      }
      instance.publish(topic, JSON.stringify(message), false);
    },
    on<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        socket: YwsServerWebSocket<O>,
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvent<I, O, E>
      ) => void
    ) {
      events.on(event, handler);
    },
    once<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        socket: YwsServerWebSocket<O>,
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvent<I, O, E>
      ) => void
    ) {
      events.once(event, handler);
    },
    off<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        socket: YwsServerWebSocket<O>,
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvent<I, O, E>
      ) => void
    ) {
      events.off(event, handler);
    },
  };
}
