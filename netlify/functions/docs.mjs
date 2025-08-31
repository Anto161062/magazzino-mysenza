import { getStore } from "@netlify/blobs";

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
}

/**
 * POST   /docs -> upload PDF (binary body). Query: txId, type (IN|OUT), name
 * GET    /docs?list=1 -> list metadata
 * GET    /docs?id=...  -> stream file
 * DELETE /docs?id=...  -> delete file and meta
 */
export default async (req, ctx) => {
  const bin = getStore("mysenza-docs");
  const meta = getStore("mysenza-docs-meta");

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const list = url.searchParams.get("list");
  const txId = url.searchParams.get("txId");
  const typ = url.searchParams.get("type");
  const name = url.searchParams.get("name");

  if (req.method === "POST") {
    if (!txId || !typ || !name) return new Response("Missing query (txId,type,name)", { status: 400 });
    const arr = new Uint8Array(await req.arrayBuffer());
    const docId = uuid();
    await bin.set(docId, new Blob([arr], { type: "application/pdf" }), { contentType: "application/pdf" });
    const metaObj = { id: docId, txId, type: typ, name, date: new Date().toISOString(), mime: "application/pdf" };
    await meta.set(docId, JSON.stringify(metaObj), { contentType: "application/json" });
    return new Response(JSON.stringify({ id: docId, ...metaObj }), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "GET" && list) {
    const keys = await meta.list();
    const out = [];
    for (const k of keys.blobs) {
      const j = await meta.get(k.key, { type: "json" });
      if (j) out.push(j);
    }
    // sort desc by date
    out.sort((a,b)=> new Date(b.date) - new Date(a.date));
    return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
  }

  if (req.method === "GET" && id) {
    const blob = await bin.get(id, { type: "blob" });
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob, { headers: { "content-type": "application/pdf" } });
  }

  if (req.method === "DELETE" && id) {
    await bin.delete(id);
    await meta.delete(id);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  return new Response("Bad request", { status: 400 });
}
