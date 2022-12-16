import EventEmitter from "eventemitter3";
import { nanoid } from "nanoid";
import type { WebSocket } from "uWebSockets.js";
import { App } from "uWebSockets.js";
import { z } from "zod";
import type {
  DataFromDefaultEvents,
  DefaultEvents,
  ServerOptions,
  YwsServerWebSocket,
} from "./types";

export {
  DataFromDefaultEvents,
  DefaultEvents,
  ServerOptions,
  YwsServerWebSocket,
};

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
        ws.id = nanoid();
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
          ws.end(1003, "Binary data is not supported");
          return;
        }

        const raw = decoder.decode(message);

        try {
          let data;
          const json = JSON.parse(raw);
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

          events.emit(data[matchEventsOn], getWebSocket(ws), data);
          events.emit("message", getWebSocket(ws), data);
        } catch (error) {
          events.emit("error", getWebSocket(ws), {
            ...(error as Error),
            at: Date.now(),
          });
        }
      },
    })

    .any("/*", (res, req) => {
      res.writeStatus("404");
      res.end("Not found");
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
      id: ws.id,

      publish(topic, data) {
        const parsed = outgoing.safeParse(data);

        if (parsed.success) {
          return ws.publish(topic, JSON.stringify(parsed.data), false);
        }

        events.emit("invalidPayload", getWebSocket(ws), {
          at: Date.now(),
          type: "outgoing",
          data,
        });

        return false;
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
      },
    };
  }

  return {
    publish(topic: string, message: z.infer<O>) {
      const parsed = outgoing.safeParse(message);

      if (parsed.success) {
        return instance.publish(topic, JSON.stringify(parsed.data), false);
      }

      return events.emit("invalidPayload", null, {
        at: Date.now(),
        type: "outgoing",
        data: message,
      });
    },
    on<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
        socket: YwsServerWebSocket<O>,
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvents<I, O, E>
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
          : DataFromDefaultEvents<I, O, E>
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
          : DataFromDefaultEvents<I, O, E>
      ) => void
    ) {
      events.off(event, handler);
    },
  };
}
