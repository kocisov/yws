import Client from "../dist/client";
import { clientMessages, serverMessages } from "./messages";

const client = Client({
  url: "ws://127.0.0.1:3420",
  matchEventsOn: "event",
  incoming: serverMessages,
  outgoing: clientMessages,
});

client.on("open", (event) => {
  console.log("[WS] Opened", event);
  client.send({ event: "join", room: "randomNumberEvery100ms" });
});

client.on("left", ({ room }) => {
  console.log("[WS] Left room:", room);
});

client.on("randomNumber", (data) => {
  console.log("[WS] Got a Random Number:", data.value);
});

client.on("close", (event) => {
  console.log("[WS] Closed", event.code, event.reason);
});

client.on("message", (message) => {
  console.log("[WS] Message", message);
});
