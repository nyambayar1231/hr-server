import * as bcrypt from 'bcrypt';

export const generateHash = async () => {
  const salt = await bcrypt.genSalt();
  const password = 'random_password';
  const hash = await bcrypt.hash(password, salt);
};
