import ImageKit from "imagekit";
import config from "./config.js";

const imagekit = new ImageKit({
  publicKey: config.imagekit.imagekit_public,
  privateKey: config.imagekit.imagekit_private,
  urlEndpoint: config.imagekit.imagekit_url,
});

export default imagekit;