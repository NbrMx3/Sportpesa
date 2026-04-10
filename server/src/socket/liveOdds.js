import { config } from "../config.js";
import { getFootballQueryWindow, resolveFootballFeed } from "../utils/footballFeed.js";

export function startLiveOdds(io) {
  io.on("connection", (socket) => {
    const queryWindow = getFootballQueryWindow(socket.handshake.query || {});
    let isPublishing = false;

    const publish = async (eventName) => {
      if (isPublishing) {
        return;
      }

      isPublishing = true;

      try {
        const payload = await resolveFootballFeed(queryWindow);
        socket.emit(eventName, payload);
      } finally {
        isPublishing = false;
      }
    };

    void publish("odds:snapshot");

    const intervalId = setInterval(() => {
      void publish("odds:update");
    }, config.liveOddsRefreshMs);

    socket.on("disconnect", () => {
      clearInterval(intervalId);
    });
  });
}
