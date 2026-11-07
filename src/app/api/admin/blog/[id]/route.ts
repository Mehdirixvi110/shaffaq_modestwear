import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { blogPostFields } from "@/lib/validation";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const patchSchema = z.object({ expectedVersion: z.number().int().positive(), ...blogPostFields }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request);
    const id = z.coerce.number().int().positive().parse((await context.params).id);
    const input = patchSchema.parse(await request.json());
    const result = await withAdminAudit(actor, "cms.blog.update", "blog_post", String(id), { slug: input.slug, status: input.status }, async (connection) => {
      const existing = await connection.prepare("SELECT published_at AS publishedAt FROM blog_posts WHERE id = ?").get<{ publishedAt: number | null }>(id);
      if (!existing) throw new ApiError(404, "BLOG_NOT_FOUND", "Blog post not found.");
      // Stamp published_at the first time it goes live, keep the original date on later
      // edits, and clear it when the post is returned to draft.
      const publishedAt = input.status === "PUBLISHED" ? (existing.publishedAt ?? Date.now()) : null;
      try {
        const update = await connection.prepare(`UPDATE blog_posts SET slug=?, title=?, excerpt=?, body=?, cover_image_path=?, cover_image_alt=?, author=?, status=?, published_at=?, seo_title=?, seo_description=?, version=version+1, updated_at=unixepoch()*1000 WHERE id=? AND version=?`)
          .run(input.slug, input.title, input.excerpt, input.body, input.coverImagePath, input.coverImageAlt, input.author, input.status, publishedAt, input.seoTitle, input.seoDescription, id, input.expectedVersion);
        if (update.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "This blog post changed in another session. Reload and try again.");
        return { id, version: input.expectedVersion + 1 };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.message.includes("UNIQUE")) throw new ApiError(409, "BLOG_SLUG_CONFLICT", "A blog post with this slug already exists.");
        throw error;
      }
    });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await authorizeAdminMutation(request);
    const id = z.coerce.number().int().positive().parse((await context.params).id);
    await withAdminAudit(actor, "cms.blog.delete", "blog_post", String(id), {}, async (connection) => {
      const result = await connection.prepare("DELETE FROM blog_posts WHERE id = ?").run(id);
      if (!result.changes) throw new ApiError(404, "BLOG_NOT_FOUND", "Blog post not found.");
    });
    return NextResponse.json({ id });
  } catch (error) { return apiErrorResponse(error); }
}
