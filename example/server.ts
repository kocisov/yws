import Server from "../server";
import { clientMessages, serverMessages } from "./messages";

const server = Server({
  matchEventsOn: "t",
  incoming: clientMessages,
  outgoing: serverMessages,
  // port: Number(process.env.PORT ?? 3420),
});

server.on("open", (socket) => {
  console.log(socket.getSubscriptions());

  socket.subscribe("messageEvery100ms");

  console.log(socket.getSubscriptions());
});

server.on("something", (socket, data) => {}); // This should be an error

let pings = 0;

server.on("ping", (socket, data) => {
  pings++;
  socket.send({ t: "pong" });
  socket.send({ t: "ok" }); // This should be an error as well
});

server.on("message", (socket, data) => {
  socket.send({ t: "test-out", p: pings });
});

server.on("invalidPayload", (socket, payload) => {
  console.log("Invalid Payload", payload);
});

server.on("error", (socket, error) => {
  console.log(error);
});

setInterval(() => {
  server.publish("messageEvery100ms", {
    t: "pong",
  });
}, 100);
