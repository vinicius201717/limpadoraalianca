import bcrypt from "bcryptjs";

import { users } from "./demo-data";

const passwordHash = bcrypt.hashSync("123456", 10);

export const authUsers = users.map((user) => ({
  ...user,
  passwordHash,
}));
