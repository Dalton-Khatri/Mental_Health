const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Test User",
      email: "test@example.com",
      passwordHash: "dummyhash123"
    }
  });
  console.log("Created:", user);
}

main().finally(() => prisma.$disconnect());