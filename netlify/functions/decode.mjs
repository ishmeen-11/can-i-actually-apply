// Netlify function: sends a job posting + the user's profile to an LLM (Groq or Gemini) and
// returns a structured, line-by-line requirements check as JSON.
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
  const groq = process.env.GROQ_API_KEY, gemini = process.env.GEMINI_API_KEY;
  if (!groq && !gemini) return json({ error: "Set GROQ_API_KEY or GEMINI_API_KEY on Netlify" }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const posting = String(body.posting || "").slice(0, MAX_CHARS);
  if (posting.length < 50) return json({ error: "Posting too short" }, 400);
  const profile = JSON.stringify(body.profile || {}).slice(0, 4000);
  const user = `CANDIDATE PROFILE:\n${profile}\n\nJOB POSTING:\n${posting}`;

  let text;
  try {
    text = groq ? await callGroq(groq, user) : await callGemini(gemini, user);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 502);
  }
  const match = text.match(/\{[\s\S]*\}/);
  try {
    return json(JSON.parse(match ? match[0] : text));
  } catch {
    return json({ error: "Could not parse model output" }, 502);
  }
};

async function callGroq(key, user) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(key, user) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
