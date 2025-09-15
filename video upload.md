Below is a single, drop‑in Markdown you can add to your repo as **`VIDEO_STREAMING_CLOUDFLARE.md`**.
It consolidates the plan around **Cloudflare Stream** + **Supabase Edge Functions** for direct uploads, webhooks, and instant HLS playback. It includes schema, environment, function code, client snippets, deployment, and validation.

---

# Video Streaming (Cloudflare Stream) — Implementation Guide

**Goal:** 30‑second product‑demo videos with **instant, reliable playback** in a TikTok‑style feed.

**What this sets up**

* **Direct creator uploads** (browser → Cloudflare Stream) using one‑time upload URLs.
* **Webhooks** to mark videos **ready** with HLS/DASH + thumbnails & metadata.
* **Playback** using your own player (`hls.js`) + prefetching for fast swipes.
* **Supabase** for DB/storage + **Edge Functions** (Deno) for the API glue.

> References:
>
> * Direct Creator Uploads return a one‑time `uploadURL` + the asset `uid`. ([Cloudflare Docs][1])
> * Webhook verification uses `Webhook‑Signature` with `time` and `sig1`, computed as HMAC‑SHA256 over `time + "." + rawBody`. ([Cloudflare Docs][2])
> * HLS/DASH manifest URLs are provided in webhooks (`playback.hls`/`playback.dash`) and follow the documented patterns. ([Cloudflare Docs][2])
> * Supabase Edge Functions: set auth context from the incoming `Authorization` header when you need RLS. ([Supabase][3])
> * To lock playback to your domain or sign URLs later, use **Allowed Origins** / **Signed URLs**. ([Cloudflare Docs][4])

---

## 0) Environment & Secrets

Add the following project secrets (Supabase Dashboard → **Project Settings → Functions → Secrets**):

```
# Supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only (Edge Functions), bypasses RLS when needed

# Cloudflare Stream
STREAM_ACCOUNT_ID=...
STREAM_API_TOKEN=...            # token with Stream permissions
STREAM_WEBHOOK_SECRET=...       # returned when you set webhook URL via API

# Optional playback security (later)
# STREAM_REQUIRE_SIGNED_URLS=true/false
# STREAM_CUSTOM_CODE=customer-<CODE>  # if you enabled a customer playback domain
```

---

## 1) Database: Tables & Indexes

Create (or migrate) the following schema. (If you already have `users`, keep it; this only adds/updates video columns.)

```sql
-- videos: core metadata + provider fields
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text,
  tags jsonb default '[]'::jsonb,

  -- Cloudflare Stream specific
  provider text check (provider in ('stream')) default 'stream',
  provider_asset_id text,           -- Stream UID (from webhook/creation)
  hls_url text,
  dash_url text,
  thumbnail_url text,

  duration_s int,
  width int,
  height int,

  status text check (status in ('uploading','processing','ready','rejected')) default 'uploading',
  moderation_state text check (moderation_state in ('pending','approved','limited','rejected')) default 'pending',
  created_at timestamptz default now()
);

create index if not exists idx_videos_ready on videos((status)) where status='ready';
create index if not exists idx_videos_created on videos(created_at desc);
```

---

## 2) Supabase Edge Functions (Deno)

Create these files:

```
/supabase
  /functions
    /_shared
      cors.ts
      supabaseAdmin.ts
    /init-upload
      index.ts
    /video-webhooks
      index.ts
config.toml
```

### `_shared/cors.ts`

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
```

### `_shared/supabaseAdmin.ts`

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Optional: RLS-aware client using caller's Authorization header (if using Supabase Auth). */
export function supabaseFromRequest(req: Request) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}
```

### `init-upload/index.ts` — Create DB row + one‑time upload URL

* For 30s demos, basic **Direct Creator Upload** is simplest (≤200 MB). If you need resumable uploads, switch to the **tus** flow later (doc shows how to proxy the `Location` header). ([Cloudflare Docs][1])

```ts
// deno-lint-ignore-file no-explicit-any
import { supabaseAdmin, supabaseFromRequest } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

const STREAM_ACCOUNT_ID = Deno.env.get("STREAM_ACCOUNT_ID")!;
const STREAM_API_TOKEN = Deno.env.get("STREAM_API_TOKEN")!;

type Body = {
  title: string;
  description?: string;
  tags?: string[];
  maxDurationSeconds?: number;   // default 45
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Identify user (Supabase Auth: from Authorization header; or pass x-user-id for your external auth)
    let userId: string | null = null;
    const rls = supabaseFromRequest(req);
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await rls.auth.getUser(token);
      if (user?.id) userId = user.id;
    }
    if (!userId) userId = req.headers.get("x-user-id"); // fallback for non-Supabase auth
    if (!userId) return json({ error: "Unauthorized: missing user" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.title) return json({ error: "Missing 'title'" }, 400);

    const maxDurationSeconds = body.maxDurationSeconds ?? 45;

    // 1) Insert DB row (status = uploading)
    const { data: row, error: insErr } = await supabaseAdmin
      .from("videos")
      .insert({
        user_id: userId,
        title: body.title,
        description: body.description ?? null,
        tags: body.tags ?? [],
        status: "uploading",
        moderation_state: "pending",
        provider: "stream",
      })
      .select("id")
      .single();

    if (insErr || !row) return json({ error: insErr?.message ?? "DB insert failed" }, 500);

    // 2) Request direct creator upload URL from Cloudflare Stream
    // API: POST /client/v4/accounts/{account_id}/stream/direct_upload
    // Response contains { result: { uploadURL, uid }, ... }  (doc example shows these exact fields). :contentReference[oaicite:6]{index=6}
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${STREAM_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STREAM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds,
          // requireSignedURLs: Deno.env.get("STREAM_REQUIRE_SIGNED_URLS") === "true" ? true : false
        }),
      },
    );

    const cf = await resp.json();
    if (!resp.ok) return json({ error: "Cloudflare direct_upload failed", detail: cf }, 502);

    const { uploadURL, uid } = cf.result ?? {};
    if (!uploadURL || !uid) return json({ error: "Invalid Cloudflare response" }, 502);

    // 3) Store the asset UID for correlation (webhook will update URLs)
    await supabaseAdmin.from("videos")
      .update({ provider_asset_id: uid, status: "processing" })
      .eq("id", row.id);

    return json({
      videoId: row.id,
      provider: "stream",
      uploadUrl: uploadURL,
      uploadId: uid,
    }, 201);
  } catch (e: any) {
    return json({ error: e?.message ?? "Unhandled error" }, 500);
  }
});
```

> **Notes**
>
> * The upload URL is one‑time and accepts **HTTP POST** with formdata for files ≤200 MB (use tus later if you need resumable >200 MB). ([Cloudflare Docs][1])

### `video-webhooks/index.ts` — Verify signature & mark **ready**

```ts
// deno-lint-ignore-file no-explicit-any
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders } from "../_shared/cors.ts";

const te = new TextEncoder();
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacSHA256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(message));
  return toHex(sig);
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Important: read raw text for signature verification
  const raw = await req.text();
  const sigHeader = req.headers.get("Webhook-Signature"); // format: time=...,sig1=...  :contentReference[oaicite:8]{index=8}
  const secret = Deno.env.get("STREAM_WEBHOOK_SECRET")!;

  try {
    if (!sigHeader || !secret) return json({ error: "Missing signature" }, 400);
    const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=") as [string, string]));
    const time = parts["time"];
    const sig1 = parts["sig1"];
    if (!time || !sig1) return json({ error: "Bad signature header" }, 400);

    // Expected signature: HMAC-SHA256(secret, time + "." + rawBody)  :contentReference[oaicite:9]{index=9}
    const expected = await hmacSHA256Hex(secret, `${time}.${raw}`);
    const valid = expected.toLowerCase() === sig1.toLowerCase();
    if (!valid) return json({ error: "Invalid signature" }, 401);

    const body = JSON.parse(raw);
    const uid: string | undefined = body?.uid;
    const state: string | undefined = body?.status?.state;
    const readyToStream: boolean | undefined = body?.readyToStream;

    if (!uid) return json({ error: "Missing uid" }, 400);

    if (state === "ready" && readyToStream) {
      // When processing finishes, webhook often includes playback URLs & dimensions. :contentReference[oaicite:10]{index=10}
      const update = {
        status: "ready",
        hls_url: body?.playback?.hls ?? null,
        dash_url: body?.playback?.dash ?? null,
        thumbnail_url: body?.thumbnail ?? null,
        duration_s: body?.duration ? Math.round(Number(body.duration)) : null,
        width: body?.input?.width ?? null,
        height: body?.input?.height ?? null,
      };

      // Fallback if playback URLs not present: compute from UID and (optional) customer code. :contentReference[oaicite:11]{index=11}
      if (!update.hls_url) {
        const custom = Deno.env.get("STREAM_CUSTOM_CODE"); // e.g., customer-f33zs165nr7gyfy4
        update.hls_url = custom
          ? `https://${custom}.cloudflarestream.com/${uid}/manifest/video.m3u8`
          : `https://videodelivery.net/${uid}/manifest/video.m3u8`;
      }

      const { error } = await supabaseAdmin
        .from("videos")
        .update(update)
        .eq("provider", "stream")
        .eq("provider_asset_id", uid);

      if (error) return json({ error: error.message }, 500);
    }

    if (state === "error") {
      await supabaseAdmin
        .from("videos")
        .update({ status: "rejected" })
        .eq("provider", "stream")
        .eq("provider_asset_id", uid);
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unhandled" }, 500);
  }
});
```

### `config.toml` (Edge Functions)

```toml
[functions.init-upload]
verify_jwt = false # set true if calling from browser with Supabase Auth session

[functions.video-webhooks]
verify_jwt = false # webhooks come from Cloudflare, not the browser
```

> **Setting the webhook URL**
> Use the Cloudflare API to set your webhook endpoint and receive the **secret** you must save as `STREAM_WEBHOOK_SECRET`:
>
> ```bash
> curl -X PUT \
>   -H "Authorization: Bearer $STREAM_API_TOKEN" \
>   https://api.cloudflare.com/client/v4/accounts/$STREAM_ACCOUNT_ID/stream/webhook \
>   --data '{"notificationUrl":"https://<YOUR-SUPABASE-PROJECT-URL>/functions/v1/video-webhooks"}'
> ```
>
> The response includes `"secret": "<...>"`. Store this in `STREAM_WEBHOOK_SECRET`. ([Cloudflare Docs][2])

---

## 3) Client — Upload & Playback

### A) Create an upload (call your Edge Function)

```ts
// Create a new upload session
const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/init-upload`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // If using Supabase Auth:
    // Authorization: `Bearer ${supabase.auth.getSession()?.data.session?.access_token}`,
    // If using external auth (e.g., Clerk), call from your server and set x-user-id.
    "x-user-id": currentUserId, // remove if using Supabase Auth
  },
  body: JSON.stringify({ title, description, tags, maxDurationSeconds: 45 }),
});
const { uploadUrl, videoId } = await res.json();
```

### B) Upload the file to Cloudflare Stream

```ts
const form = new FormData();
form.append("file", file); // File from <input type="file">

const uploadResp = await fetch(uploadUrl, {
  method: "POST",
  body: form,
});
if (!uploadResp.ok) throw new Error("Upload failed");

// The webhook will mark the video row as `ready` and populate HLS/DASH/thumbnail.
```

> For uploads > 200 MB or to support resuming, switch to **tus** (Cloudflare’s doc includes a Worker example that forwards the `Location` header and metadata). ([Cloudflare Docs][1])

### C) Play with your own player (`hls.js`)

```tsx
import Hls from "hls.js";

export function attachHls(videoEl: HTMLVideoElement, hlsUrl: string) {
  if (Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true });
    hls.loadSource(hlsUrl);
    hls.attachMedia(videoEl);
    return () => hls.destroy();
  } else {
    // Safari/iOS has native HLS
    videoEl.src = hlsUrl;
    return () => { videoEl.removeAttribute("src"); videoEl.load(); };
  }
}
```

> **Manifest URLs** come from the webhook (`playback.hls` / `playback.dash`). If needed, you can also build them with your **customer playback domain**:
> `https://customer-<CODE>.cloudflarestream.com/<UID>/manifest/video.m3u8`. ([Cloudflare Docs][5])

### D) (Optional) Prefetch for fast swipes

* When video *i* starts, `fetch()` the **next item’s** `.m3u8` and the first 1–2 segments; cancel if user swipes back.
* Add `<link rel="preconnect">` to the Cloudflare Stream domain.
* Keep a tight buffer to avoid memory creep on mobile.

---

## 4) Security & Moderation (MVP stance)

* **Allowed Origins**: Restrict manifests/segments to your domain (works with own player). Enable in Stream settings when you go public. ([Cloudflare Docs][4])
* **Signed URLs**: If you need gated content, set `requireSignedURLs` on uploads and sign HLS requests server‑side (add later). ([Cloudflare Docs][4])
* **Moderation**: Keep `moderation_state='pending'` on upload; only add to public feed after automated checks pass (outside scope here; plug in your existing moderation job).

---

## 5) Deploy

```bash
# From your project root
supabase functions deploy init-upload
supabase functions deploy video-webhooks
```

Then set the webhook URL (see above) and store the returned `secret` in `STREAM_WEBHOOK_SECRET`. ([Cloudflare Docs][2])

---

## 6) Validation & Acceptance

**Acceptance criteria**

* You can upload a 30s MP4, and the DB row transitions `uploading → processing → ready`.
* The row contains `hls_url`, `thumbnail_url`, `duration_s`, `width`, `height`.
* Playback starts **≤400 ms** on desktop broadband, **≤800 ms** on mid‑tier mobile.

**Validation steps**

1. **Upload flow**: Call `init-upload` → POST file to `uploadURL` → confirm webhook call (200) → DB updated.
2. **Manifest**: In DevTools, ensure `.m3u8` and \~2s segments are fetched (CMAF/HLS).
3. **Player**: Test Safari (native HLS) and Chrome/Android (`hls.js`).
4. **Webhook signature**: Tamper with body to ensure your verifier rejects it (401). (Header is `Webhook‑Signature` with `time` and `sig1`—see doc). ([Cloudflare Docs][2])
5. **(Optional) Allowed Origins**: Enable and confirm other origins cannot play. ([Cloudflare Docs][4])

---

## 7) Operational Notes

* **Quotas & Billing**: Direct upload links reserve storage until processing completes. (Doc notes this behavior.) ([Cloudflare Docs][1])
* **HLS vs DASH**: Use HLS on web; DASH optional. Cloudflare provides both manifests. ([Cloudflare Docs][5])
* **Analytics/QoE**: Use Stream analytics dashboard for startup time & rebuffer percent; add Sentry in app for player errors.
* **Future hardening**: Signed URLs; customer playback domain; tus uploads; per‑user rate limiting on uploads and views.

---

## 8) Quick FAQ

**Q: Do I need tus/resumable uploads now?**
A: If your 30‑second demos are typically <200 MB, **no**—basic direct upload is simpler. Switch to tus later if you see upload failures on flaky mobile networks or larger files. ([Cloudflare Docs][1])

**Q: Where do I get the manifest URL?**
A: From the webhook payload (`playback.hls` / `playback.dash`). You can also construct them using your **customer domain** + `uid` if configured. ([Cloudflare Docs][2])

**Q: How do I ensure only my site can play the videos?**
A: Turn on **Allowed Origins** (and eventually **Signed URLs**) in Stream. ([Cloudflare Docs][4])

---

## 9) What’s next (beyond streaming)

* **Feed API + Redis** for ranked pages (fast pagination).
* **Likes/Comments** with Supabase Realtime.
* **Trending** with Wilson score + decay.
* **Prefetcher tuning** and Service Worker `preconnect` for sub‑300 ms TTFF on desktop.

---

### Appendix: Cloudflare references

* **Direct Creator Uploads** (one‑time URL + `uid`): how to create and POST the file. ([Cloudflare Docs][1])
* **Webhooks** (verify `Webhook‑Signature`, read `readyToStream`, `status.state`, `playback` URLs, `thumbnail`, dimensions): setup & verification steps. ([Cloudflare Docs][2])
* **Use your own player** (HLS/DASH URL patterns & fetching manifests): examples and customer domain pattern. ([Cloudflare Docs][5])
* **Secure your Stream** (Allowed Origins, Signed URLs): lock playback to your domain or sign requests. ([Cloudflare Docs][4])
* **Supabase Edge Functions auth context**: pass `Authorization` to enforce RLS when needed. ([Supabase][3])

---

**That’s it.** Paste this file into your repo, deploy the two functions, set the webhook, and you’ll have a complete Cloudflare Stream pipeline from upload → processing → instant HLS playback.

[1]: https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/ "Direct creator uploads · Cloudflare Stream docs"
[2]: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/ "Use webhooks · Cloudflare Stream docs"
[3]: https://supabase.com/docs/guides/functions/auth?utm_source=chatgpt.com "Integrate Supabase Auth with Edge Functions"
[4]: https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/?utm_source=chatgpt.com "Secure your Stream"
[5]: https://developers.cloudflare.com/stream/viewing-videos/using-own-player/ "Use your own player · Cloudflare Stream docs"
