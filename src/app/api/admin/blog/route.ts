import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { blogPostFields } from "@/lib/validation";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const createSchema = z.object(blogPostFields).strict();

export async function POST(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request);
    const input = createSchema.parse(await request.json());
    const id = await withAdminAudit(actor, "cms.blog.create", "blog_post", null, { slug: input.slug, status: input.status }, async (connection) => {
      const publishedAt = input.status === "PUBLISHED" ? Date.now() : null;
      try {
        const result = await connection.prepare(`INSERT INTO blog_posts (slug, title, excerpt, body, cover_image_path, cover_image_alt, author, status, published_at, seo_title, seo_description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(input.slug, input.title, input.excerpt, input.body, input.coverImagePath, input.coverImageAlt, input.author, input.status, publishedAt, input.seoTitle, input.seoDescription);
        return result.lastInsertRowid;
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "BLOG_SLUG_CONFLICT", "A blog post with this slug already exists.");
        throw error;
      }
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
