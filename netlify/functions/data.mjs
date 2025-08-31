import { getStore } from "@netlify/blobs";

/**
 * GET  -> returns full dataset { products, transactions, invoicesMeta }
 * POST -> body JSON to overwrite dataset (simple single-tenant store)
 */
export default async (req, ctx) => {
  const store = getStore("mysenza-magazzino");
  const key = "data.json";

  if (req.method === "GET") {
    const text = await store.get(key, { type: "text" });
    if (!text) {
      const empty = { products: [], transactions: [], invoicesMeta: [] };
      await store.set(key, JSON.stringify(empty), { contentType: "application/json" });
      return new Response(JSON.stringify(empty), { headers: { "content-type": "application/json" } });
    }
    return new Response(text, { headers: { "content-type": "application/json" } });
  }

  if (req.method === "POST") {
    const body = await req.text();
    // naive validation: must be JSON with arrays
    let data;
    try { data = JSON.parse(body) } catch(e) { return new Response("Bad JSON", { status: 400 }) }
    if (!data || !Array.isArray(data.products) || !Array.isArray(data.transactions) || !Array.isArray(data.invoicesMeta)) {
      return new Response("Invalid schema", { status: 400 });
    }
    await store.set(key, JSON.stringify(data), { contentType: "application/json" });
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }

  return new Response("Method not allowed", { status: 405 });
}
