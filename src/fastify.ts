import type { SocketStream } from "fastify-websocket";
import { nanoid } from "nanoid";
import type { WebSocket } from "ws";

type Out<Incoming, Outgoing> = {
  raw: WebSocket;
  id: string;
  onMessage(handler: (data: Incoming) => void): void;
  join(channel: string): void;
  leave(channel: string): void;
  broadcast(channelOrData: string | Outgoing, data?: Outgoing): void;
  commit(data: Outgoing): void;
};

const channels: Record<string, Record<string, ReturnType<typeof wrap>>> = {
  all: {},
};

export function wrap<Incoming, Outgoing>(connection: SocketStream): Out<Incoming, Outgoing> {
  connection.setEncoding("utf-8");
  connection.setDefaultEncoding("utf-8");

  const raw = connection.socket;
  const id = nanoid();

  const wrapped: Out<Incoming, Outgoing> = {
    raw,
    id,
    onMessage(handler) {
      raw.on("message", (message, isBinary) => {
        if (isBinary) {
          return;
        }
        try {
          const data = JSON.parse(message.toString());
          return handler(data);
        } catch {}
      });
    },
    join(channel) {
      if (!channels[channel]) {
        channels[channel] = {};
      }
      if (!channels[channel][id]) {
        channels[channel][id] = wrapped;
      }
    },
    leave(channel) {
      if (!channels[channel][id]) {
        return;
      }
      if (Object.keys(channels[channel]).length === 1) {
        delete channels[channel];
        return;
      }
      delete channels[channel][id];
    },
    broadcast(channelOrData, data) {
      if (typeof channelOrData !== "string") {
        for (const savedId in channels.all) {
          channels.all[savedId].commit(channelOrData);
        }
      } else {
        for (const savedId in channels[channelOrData]) {
          channels[channelOrData][savedId].commit(data);
        }
      }
    },
    commit(data) {
      if (raw.readyState === raw.OPEN) {
        raw.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    },
  };

  wrapped.join("all");

  raw.on("close", () => {
    for (const channel of Object.keys(channels)) {
      console.log("LEAVING", channel, id);
      wrapped.leave(channel);
    }
  });

  return wrapped;
}
