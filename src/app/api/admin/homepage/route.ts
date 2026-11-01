import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminMutation, withAdminAudit } from "@/server/admin";
import { apiErrorResponse, ApiError } from "@/server/http";

const nullable = (max: number) => z.string().trim().max(max).nullable();
const schema = z.object({
  settings: z.object({ announcement: nullable(300), heroEyebrow: nullable(120), heroTitle: z.string().trim().min(1).max(200), heroBody: nullable(1000), heroCtaLabel: nullable(80), heroCtaUrl: nullable(300), heroDesktopPath: nullable(500), heroMobilePath: nullable(500), version: z.number().int().positive() }).strict(),
  sections: z.array(z.object({ id: z.number().int().positive(), type: z.enum(["CATEGORY_GRID", "FEATURED", "CAMPAIGN", "EDITORIAL", "REVIEWS", "SERVICES"]), title: nullable(200), body: nullable(1000), imagePath: nullable(500), linkLabel: nullable(80), linkUrl: nullable(300), visible: z.boolean(), position: z.number().int().min(0).max(50) }).strict()).length(6),
}).strict();

export async function PATCH(request: NextRequest) {
  try {
    const actor = await authorizeAdminMutation(request); const input = schema.parse(await request.json());
    if (new Set(input.sections.map((section) => section.id)).size !== input.sections.length || new Set(input.sections.map((section) => section.position)).size !== input.sections.length) throw new Error("Duplicate homepage section.");
    await withAdminAudit(actor, "cms.homepage.update", "homepage", "1", { visibleSections: input.sections.filter((section) => section.visible).length }, async (connection) => {
      const settings = input.settings;
      for (const imagePath of [settings.heroDesktopPath, settings.heroMobilePath, ...input.sections.map((section) => section.imagePath)]) if (imagePath && !await connection.prepare("SELECT 1 FROM media_files WHERE public_path = ? AND replaced_at IS NULL").get(imagePath)) throw new ApiError(422, "MEDIA_NOT_FOUND", "A selected image is no longer available.");
      const settingsUpdate = await connection.prepare(`UPDATE settings SET announcement=?, hero_eyebrow=?, hero_title=?, hero_body=?, hero_cta_label=?, hero_cta_url=?, hero_desktop_path=?, hero_mobile_path=?, version=version+1, updated_at=unixepoch()*1000 WHERE id=1 AND version=?`)
        .run(settings.announcement, settings.heroEyebrow, settings.heroTitle, settings.heroBody, settings.heroCtaLabel, settings.heroCtaUrl, settings.heroDesktopPath, settings.heroMobilePath, settings.version);
      if (settingsUpdate.changes !== 1) throw new ApiError(409, "VERSION_CONFLICT", "Homepage settings changed in another session. Reload and try again.");
      await connection.prepare("UPDATE homepage_sections SET position = position + 1000").run();
      const update = connection.prepare("UPDATE homepage_sections SET title=?, body=?, image_path=?, link_label=?, link_url=?, visible=?, position=?, updated_at=unixepoch()*1000 WHERE id=? AND type=?");
      for (const section of input.sections) await update.run(section.title, section.body, section.imagePath, section.linkLabel, section.linkUrl, section.visible ? 1 : 0, section.position, section.id, section.type);
    });
    return NextResponse.json({ ok: true, version: input.settings.version + 1 });
  } catch (error) { return apiErrorResponse(error); }
}
