import bcrypt from 'bcryptjs';

async function hashPassword() {
  const password = 'admin'; // The password you want to hash
  const saltRounds = 10;    // A standard value for security

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('Original Password:', password);
    console.log('Hashed Password:', hashedPassword);
  } catch (error) {
    console.error('Error hashing password:', error);
  }
}

hashPassword();