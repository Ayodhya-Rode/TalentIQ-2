import Razorpay from "razorpay";
import config from "./config.js";

const razorpay = new Razorpay({
  key_id: config.razorpay.razorpay_key_id,
  key_secret: config.razorpay.razorpay_key_secret,
});

export default razorpay;