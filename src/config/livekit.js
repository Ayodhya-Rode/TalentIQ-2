import { AccessToken } from "livekit-server-sdk";
import config from "./config.js";

export const createLiveKitToken = async ({ identity, name, roomName }) => {
  const at = new AccessToken(config.livekit.livekit_api_key, config.livekit.livekit_api_secret, {
    identity,
    name,
    ttl: "30m",
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return at.toJwt();
};