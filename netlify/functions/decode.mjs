// Netlify function: sends a job posting + the user's profile to Claude and
// returns a structured, line-by-line requirements check as JSON.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_CHARS = 20000;

const SYSTEM = `You are a blunt, kind career coach for new-grad data scientists.
You read a job posting and a candidate profile, then check every requirement line.

Rules:
- Split requirements into "required" (basic/minimum/must-have, or unlabeled requirement lines) and "preferred" (preferred/nice-to-have/bonus/plus). Ignore responsibilities, benefits, legal and salary text.
- Keep each requirement's text short (paraphrase to under 20 words).
- status for each line:
  "meets"   = profile clearly satisfies it
  "partial" = close (e.g. 1.5 years vs 2 asked, related skill, learnable tool)
  "missing" = profile lacks it
  "blocker" = cannot realistically be met (security clearance, US citizenship, PhD with no Master's alternative, 5+ years when candidate has ~1)
- Count internships, research assistantships and publications as relevant experience. "X or Y" is met if either is met. Years-of-coding asks are separate from years-of-job-title asks.
- "why": one short, specific, encouraging-but-honest sentence that references the profile.
- Only use "blocker" in required lines. A PhD listed as preferred is never a blocker.
Return ONLY JSON, no prose, matching:
{"role":"string","company":"string","level":"new-grad|entry|mid|senior|unclear",
 "requirements":[{"text":"string","section":"required|preferred","status":"meets|partial|missing|blocker","why":"string"}],
 "sponsorship":"available|not-available|unstated","new_grad":true,
 "tip":"one sentence: the single best angle for this application"}`;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: "ANTHROPIC_API_KEY is not set on Netlify" }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const posting = String(body.posting || "").slice(0, MAX_CHARS);
  if (posting.length < 50) return json({ error: "Posting too short" }, 400);
  const profile = JSON.stringify(body.profile || {}).slice(0, 4000);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM,
      messages: [{ role: "user", content: `CANDIDATE PROFILE:\n${profile}\n\nJOB POSTING:\n${posting}` }],
    }),
  });
  if (!r.ok) return json({ error: `LLM error ${r.status}`, detail: (await r.text()).slice(0, 300) }, 502);

  const data = await r.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  try {
    return json(JSON.parse(match ? match[0] : text));
  } catch {
    return json({ error: "Could not parse model output" }, 502);
  }
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
