"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const MAX_TOPIC_NAME_LENGTH = 80;

const TOPIC_PALETTE = [
  "#38bdf8",
  "#818cf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#22d3ee",
  "#f472b6",
];

export async function createTopicAction(
  name: string,
  color?: string
): Promise<{
  topic?: { id: string; name: string; slug: string; color: string };
  error?: string;
}> {
  await requireUser();

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > MAX_TOPIC_NAME_LENGTH) {
    return {
      error: `O nome do tópico deve ter entre 2 e ${MAX_TOPIC_NAME_LENGTH} caracteres.`,
    };
  }

  const slug = slugify(cleanName);
  if (!slug) {
    return { error: "Nome de tópico inválido." };
  }

  const chosenColor =
    color && /^#[0-9a-fA-F]{6}$/.test(color)
      ? color
      : TOPIC_PALETTE[Math.floor(Math.random() * TOPIC_PALETTE.length)];

  const topic = await prisma.topic.upsert({
    where: { slug },
    update: {},
    create: {
      name: cleanName,
      slug,
      color: chosenColor,
      isDefault: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
    },
  });

  updateTag(CACHE_TAGS.topics);
  revalidatePath("/questoes");
  revalidatePath("/propostos");
  revalidatePath("/");
  return { topic };
}
