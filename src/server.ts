import EventEmitter from "eventemitter3";
import { nanoid } from "nanoid";
import {
  App,
  HttpResponse,
  us_listen_socket,
  us_listen_socket_close,
  WebSocket,
} from "uWebSockets.js";
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

function setHeaders(res: HttpResponse) {
  res.writeHeader(
    "Content-Security-Policy",
    "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests"
  );
  res.writeHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.writeHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.writeHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.writeHeader("Origin-Agent-Cluster", "?1");
  res.writeHeader("Referrer-Policy", "no-referrer");
  res.writeHeader(
    "Strict-Transport-Security",
    "max-age=15552000; includeSubDomains"
  );
  res.writeHeader("X-Content-Type-Options", "nosniff");
  res.writeHeader("X-DNS-Prefetch-Control", "off");
  res.writeHeader("X-Download-Options", "noopen");
  res.writeHeader("X-Frame-Options", "SAMEORIGIN");
  res.writeHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.writeHeader("X-XSS-Protection", "0");
}

export default function Server<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  M extends keyof z.infer<I>
>({ matchEventsOn, incoming, outgoing, port }: ServerOptions<I, O>) {
  const events = new EventEmitter();
  const decoder = new TextDecoder("utf-8");

  let listeningSocket: us_listen_socket | null;
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
      setHeaders(res);
      res.end("Not found");
    })

    .listen("0.0.0.0", port, (token) => {
      listeningSocket = token;

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

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      if (listeningSocket) {
        us_listen_socket_close(listeningSocket);
        listeningSocket = null;
      }
    });
  });

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
