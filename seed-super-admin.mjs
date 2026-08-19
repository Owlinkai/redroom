import bcrypt from "bcryptjs";

// Default super admin credentials
const username = "superadmin";
const password = "RedRoom2024Super";

const hash = bcrypt.hashSync(password, 12);
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);

// Output SQL to insert
console.log(`\nSQL:`);
console.log(`INSERT INTO super_admin_credentials (username, passwordHash) VALUES ('${username}', '${hash}');`);
