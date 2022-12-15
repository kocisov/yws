import EventEmitter from "eventemitter3";
import { z } from "zod";
import type {
  ClientOptions,
  DataFromDefaultEvent,
  DefaultEvents,
} from "./types";

const WebSocket =
  typeof window === "undefined" ? require("ws") : window.WebSocket;

export default function Client<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  M extends keyof z.infer<I>
>({ matchEventsOn, incoming, outgoing, url }: ClientOptions<I, O>) {
  let socket: WebSocket;
  const events = new EventEmitter();

  function connect() {
    socket = new WebSocket(url);

    socket.onclose = (event) => {
      events.emit("close", {
        at: Date.now(),
        code: event.code,
        reason: event.reason,
      });

      setTimeout(connect, 5_000);
    };

    socket.onopen = () => {
      events.emit("open", { at: Date.now() });
    };

    socket.onmessage = (event) => {
      if (incoming) {
        const parsed = incoming.safeParse(JSON.parse(event.data));

        if (parsed.success) {
          const data = parsed.data;

          if (matchEventsOn) {
            events.emit(data[matchEventsOn], data);
          }

          events.emit("message", data);

          return;
        }

        events.emit("invalidPayload", {
          at: Date.now(),
          data: event.data,
          error: parsed.error,
        });
      }
    };
  }

  connect();

  return {
    send(data: z.infer<O>) {
      if (outgoing) {
        const parsed = outgoing.safeParse(data);

        if (parsed.success) {
          socket.send(JSON.stringify(parsed.data));
        } else {
          events.emit("invalidPayload", {
            at: Date.now(),
            data,
            error: parsed.error,
          });
        }

        return;
      }

      socket.send(JSON.stringify(data));
    },

    on<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
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
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvent<I, O, E>
      ) => void
    ) {
      events.off(event, handler);
    },
  };
}
