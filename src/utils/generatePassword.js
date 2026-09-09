import crypto from "crypto";

export const generateTempPassword = () => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const specials = "@$!%*#?&";

  const pick = (chars) => chars[crypto.randomInt(0, chars.length)];

  let password = [pick(letters), pick(numbers), pick(specials)];

  const all = letters + numbers + specials;
  while (password.length < 12) {
    password.push(pick(all));
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
};