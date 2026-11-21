import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // 1. Upsert 20 classic competitive programming topics (global across all teams)
  const topicsData = [
    { name: 'Matemática Computacional', slug: 'matematica-computacional', color: '#38bdf8', isDefault: true },
    { name: 'Pilha', slug: 'pilha', color: '#818cf8', isDefault: true },
    { name: 'Fila / Deque', slug: 'fila-deque', color: '#22d3ee', isDefault: true },
    { name: 'Árvore', slug: 'arvore', color: '#34d399', isDefault: true },
    { name: 'Grafos', slug: 'grafos', color: '#a78bfa', isDefault: true },
    { name: 'Programação Dinâmica', slug: 'programacao-dinamica', color: '#f472b6', isDefault: true },
    { name: 'Busca Binária', slug: 'busca-binaria', color: '#fbbf24', isDefault: true },
    { name: 'Algoritmos Gulosos', slug: 'algoritmos-gulosos', color: '#fb923c', isDefault: true },
    { name: 'Estruturas de Dados', slug: 'estruturas-de-dados', color: '#60a5fa', isDefault: true },
    { name: 'Strings', slug: 'strings', color: '#c084fc', isDefault: true },
    { name: 'Geometria Computacional', slug: 'geometria-computacional', color: '#2dd4bf', isDefault: true },
    { name: 'Teoria dos Números', slug: 'teoria-dos-numeros', color: '#38bdf8', isDefault: true },
    { name: 'Combinatória', slug: 'combinatoria', color: '#f87171', isDefault: true },
    { name: 'Two Pointers', slug: 'two-pointers', color: '#a3e635', isDefault: true },
    { name: 'Bitmask', slug: 'bitmask', color: '#e879f9', isDefault: true },
    { name: 'Segment Tree / BIT', slug: 'segment-tree-bit', color: '#4ade80', isDefault: true },
    { name: 'Caminhos Mínimos', slug: 'caminhos-minimos', color: '#818cf8', isDefault: true },
    { name: 'Union-Find (DSU)', slug: 'union-find-dsu', color: '#facc15', isDefault: true },
    { name: 'Backtracking', slug: 'backtracking', color: '#fb7185', isDefault: true },
    { name: 'Divisão e Conquista', slug: 'divisao-e-conquista', color: '#22d3ee', isDefault: true },
  ]

  for (const t of topicsData) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { name: t.name, color: t.color, isDefault: t.isDefault },
      create: t,
    })
  }
  console.log(`✅ Upserted ${topicsData.length} default topics.`)

  // 2. Upsert single Global System Administrator (no mocked teams/members/logs)
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@sistema.dev').trim().toLowerCase()
  const adminName = (process.env.ADMIN_NAME || 'Admin Global').trim()
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
      role: UserRole.GLOBAL_ADMIN,
      teamId: null,
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
      role: UserRole.GLOBAL_ADMIN,
      teamId: null,
      avatarColor: '#ec4899',
    },
  })
  console.log(`✅ Upserted Global Admin (${adminEmail}).`)
  console.log('🌱 Clean seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
