import EventEmitter from "eventemitter3";
import { z } from "zod";
import type {
  ClientOptions,
  DataFromDefaultEvents,
  DefaultEvents,
} from "./types";

export { ClientOptions, DataFromDefaultEvents, DefaultEvents };

const WebSocket =
  typeof window === "undefined" ? require("ws") : window.WebSocket;

export default function Client<
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  M extends keyof z.infer<I>
>({
  matchEventsOn,
  incoming,
  outgoing,
  url,
  reconnectTimeout = 2_500,
}: ClientOptions<I, O>) {
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

      setTimeout(connect, reconnectTimeout);
    };

    socket.onopen = () => {
      events.emit("open", { at: Date.now() });
    };

    socket.onmessage = (event) => {
      let json;

      try {
        json = JSON.parse(event.data);
      } catch (error) {}

      try {
        const parsed = incoming.safeParse(json);

        if (parsed.success) {
          const data = parsed.data;

          if (matchEventsOn) {
            events.emit(data[matchEventsOn], data);
          }

          events.emit("message", data);

          return;
        }

        throw new Error("InvalidPayload");
      } catch (error) {
        return events.emit("invalidPayload", {
          at: Date.now(),
          data: event.data,
          error,
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
          : DataFromDefaultEvents<I, O, E>
      ) => void
    ) {
      events.on(event, handler);
    },

    once<E extends z.infer<I>[M] | DefaultEvents>(
      event: E,
      handler: (
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
        data: E extends z.infer<I>[M]
          ? Extract<z.infer<I>, { [_ in M]: E }>
          : DataFromDefaultEvents<I, O, E>
      ) => void
    ) {
      events.off(event, handler);
    },
  };
}
