import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

// In-memory store for fallback auth mode (development only)
const fallbackUsers = new Map();

// Initialize with a default test user
async function initFallbackUsers() {
  const testUser = {
    id: "dev-user-1",
    full_name: "Test User",
    email: "test@example.com",
    phone_number: "254712345678",
    password_hash: await bcrypt.hash("test", 10),
    role: "user",
    balance: 0,
    created_at: new Date().toISOString()
  };

  const adminUser = {
    id: "dev-admin-1",
    full_name: "Admin User",
    email: "admin@sportpesa.local",
    phone_number: "254712345679",
    password_hash: await bcrypt.hash("Admin123!", 10),
    role: "admin",
    balance: 50000,
    created_at: new Date().toISOString()
  };

  fallbackUsers.set(testUser.email.toLowerCase(), testUser);
  fallbackUsers.set(testUser.phone_number, testUser);
  fallbackUsers.set(adminUser.email.toLowerCase(), adminUser);
  fallbackUsers.set(adminUser.phone_number, adminUser);
}

export async function findUserByEmail(email) {
  const normalized = String(email).toLowerCase().trim();
  return fallbackUsers.get(normalized);
}

export async function findUserByPhone(phoneNumber) {
  return fallbackUsers.get(phoneNumber);
}

export async function createUser(userData) {
  const user = {
    id: uuidv4(),
    full_name: userData.fullName,
    email: userData.email,
    phone_number: userData.phoneNumber,
    password_hash: userData.passwordHash,
    role: userData.role || "user",
    balance: userData.balance || 0,
    created_at: new Date().toISOString()
  };

  if (userData.email) {
    fallbackUsers.set(userData.email.toLowerCase(), user);
  }
  if (userData.phoneNumber) {
    fallbackUsers.set(userData.phoneNumber, user);
  }

  return user;
}

export async function getFallbackUsers() {
  return Array.from(fallbackUsers.values());
}

export { initFallbackUsers };
