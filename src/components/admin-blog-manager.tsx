"use client";

import { useState } from "react";
import { csrfFetch, responseMessage } from "./csrf-fetch";

type Media = { id: number; displayName: string; publicPath: string };
type Post = {
  id: number; slug: string; title: string; excerpt: string | null; body: string;
  coverImagePath: string | null; coverImageAlt: string | null; author: string | null;
  status: "DRAFT" | "PUBLISHED"; seoTitle: string | null; seoDescription: string | null; version: number;
};
type Draft = { slug: string; title: string; excerpt: string; body: string; coverImagePath: string; coverImageAlt: string; author: string; status: "DRAFT" | "PUBLISHED"; seoTitle: string; seoDescription: string };

const EMPTY_DRAFT: Draft = { slug: "", title: "", excerpt: "", body: "", coverImagePath: "", coverImageAlt: "", author: "SHAFFAQ", status: "DRAFT", seoTitle: "", seoDescription: "" };
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);

const serialize = (post: { slug: string; title: string; excerpt: string | null; body: string; coverImagePath: string | null; coverImageAlt: string | null; author: string | null; status: "DRAFT" | "PUBLISHED"; seoTitle: string | null; seoDescription: string | null }) => {
  const trimmed = (value: string | null) => (value ?? "").trim();
  return {
    slug: trimmed(post.slug), title: trimmed(post.title),
    excerpt: trimmed(post.excerpt) || null, body: post.body,
    coverImagePath: post.coverImagePath || null, coverImageAlt: trimmed(post.coverImageAlt) || null,
    author: trimmed(post.author) || null, status: post.status,
    seoTitle: trimmed(post.seoTitle) || null, seoDescription: trimmed(post.seoDescription) || null,
  };
};

export function AdminBlogManager({ initialPosts, media }: { initialPosts: Post[]; media: Media[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [slugEdited, setSlugEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const updatePost = (id: number, changes: Partial<Post>) => setPosts((current) => current.map((post) => post.id === id ? { ...post, ...changes } : post));
  const mediaOptions = (selected: string) => <><option value="">No cover image</option>{media.map((item) => <option key={item.id} value={item.publicPath}>{item.displayName}{selected === item.publicPath ? " (selected)" : ""}</option>)}</>;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await csrfFetch("/api/admin/blog", { method: "POST", body: JSON.stringify(serialize(draft)) });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create the post."); setBusy(false); }
  }

  async function save(post: Post) {
    setBusy(true); setMessage("");
    try {
      const response = await csrfFetch(`/api/admin/blog/${post.id}`, { method: "PATCH", body: JSON.stringify({ expectedVersion: post.version, ...serialize(post) }) });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = await response.json() as { version: number };
      updatePost(post.id, { version: result.version });
      setMessage(`"${post.title}" saved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the post."); }
    finally { setBusy(false); }
  }

  async function remove(post: Post) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await csrfFetch(`/api/admin/blog/${post.id}`, { method: "DELETE", body: "{}" });
      if (!response.ok) throw new Error(await responseMessage(response));
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete the post."); setBusy(false); }
  }

  return (
    <div className="blog-admin">
      <details className="create-panel admin-card">
        <summary>Write a new post</summary>
        <form className="admin-form-grid" onSubmit={create}>
          <label><span>Title</span><input value={draft.title} onChange={(event) => { const title = event.target.value; setDraft((current) => ({ ...current, title, slug: slugEdited ? current.slug : slugify(title) })); }} required maxLength={200} /></label>
          <label><span>Slug</span><input value={draft.slug} onChange={(event) => { setSlugEdited(true); setDraft((current) => ({ ...current, slug: event.target.value })); }} required placeholder="my-post" /></label>
          <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as "DRAFT" | "PUBLISHED" }))}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label>
          <label><span>Author</span><input value={draft.author} onChange={(event) => setDraft((current) => ({ ...current, author: event.target.value }))} maxLength={120} /></label>
          <label className="full"><span>Excerpt <small>(optional)</small></span><input value={draft.excerpt} onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))} maxLength={400} /></label>
          <label><span>Cover image</span><select value={draft.coverImagePath} onChange={(event) => setDraft((current) => ({ ...current, coverImagePath: event.target.value }))}>{mediaOptions(draft.coverImagePath)}</select></label>
          <label><span>Cover alt text</span><input value={draft.coverImageAlt} onChange={(event) => setDraft((current) => ({ ...current, coverImageAlt: event.target.value }))} maxLength={300} /></label>
          <label className="full"><span>Body</span><textarea rows={12} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} required placeholder="Use ## for a heading and - for a bullet point." /></label>
          <label><span>SEO title <small>(optional)</small></span><input value={draft.seoTitle} onChange={(event) => setDraft((current) => ({ ...current, seoTitle: event.target.value }))} maxLength={200} /></label>
          <label><span>SEO description <small>(optional)</small></span><input value={draft.seoDescription} onChange={(event) => setDraft((current) => ({ ...current, seoDescription: event.target.value }))} maxLength={400} /></label>
          <div className="full"><button className="button button--dark" type="submit" disabled={busy}>Create post</button></div>
        </form>
      </details>

      {posts.map((post) => (
        <details className="admin-card" key={post.id}>
          <summary><strong>{post.title}</strong> <span className="status-pill">{post.status === "PUBLISHED" ? "Published" : "Draft"}</span></summary>
          <div className="admin-form-grid">
            <label><span>Title</span><input value={post.title} onChange={(event) => updatePost(post.id, { title: event.target.value })} maxLength={200} /></label>
            <label><span>Slug</span><input value={post.slug} onChange={(event) => updatePost(post.id, { slug: event.target.value })} /></label>
            <label><span>Status</span><select value={post.status} onChange={(event) => updatePost(post.id, { status: event.target.value as "DRAFT" | "PUBLISHED" })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label>
            <label><span>Author</span><input value={post.author ?? ""} onChange={(event) => updatePost(post.id, { author: event.target.value })} maxLength={120} /></label>
            <label className="full"><span>Excerpt</span><input value={post.excerpt ?? ""} onChange={(event) => updatePost(post.id, { excerpt: event.target.value })} maxLength={400} /></label>
            <label><span>Cover image</span><select value={post.coverImagePath ?? ""} onChange={(event) => updatePost(post.id, { coverImagePath: event.target.value })}>{mediaOptions(post.coverImagePath ?? "")}</select></label>
            <label><span>Cover alt text</span><input value={post.coverImageAlt ?? ""} onChange={(event) => updatePost(post.id, { coverImageAlt: event.target.value })} maxLength={300} /></label>
            <label className="full"><span>Body</span><textarea rows={12} value={post.body} onChange={(event) => updatePost(post.id, { body: event.target.value })} /></label>
            <label><span>SEO title</span><input value={post.seoTitle ?? ""} onChange={(event) => updatePost(post.id, { seoTitle: event.target.value })} maxLength={200} /></label>
            <label><span>SEO description</span><input value={post.seoDescription ?? ""} onChange={(event) => updatePost(post.id, { seoDescription: event.target.value })} maxLength={400} /></label>
            <div className="full blog-admin__actions"><button className="button button--dark" type="button" disabled={busy} onClick={() => save(post)}>Save</button><a className="text-link" href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">Preview</a><button className="text-button" type="button" disabled={busy} onClick={() => remove(post)}>Delete</button></div>
          </div>
        </details>
      ))}
      {message ? <p className="form-status" role="status">{message}</p> : null}
    </div>
  );
}
