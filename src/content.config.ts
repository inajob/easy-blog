import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    url: z.string().url(),
    sourceTitle: z.string().optional(),
    image: z.string().optional(),
    youtube: z.array(z.string()).optional(),
  }),
});

export const collections = { posts };