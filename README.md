# Can I Actually Apply? 🌻

Paste a job posting, get a verdict.

Job postings mix real requirements with a wishlist. This tool splits the **Basic / Required** qualifications from the **Preferred / Nice-to-have** ones, checks each line against your profile (degree, years of experience, skills, publications, visa needs), and tells you whether to **Apply**, **Apply anyway**, treat it as a **Long shot**, or **Skip**.

It also flags:
- "No visa sponsorship" language
- Security clearance or citizenship requirements
- A PhD that's only *preferred* (ignore it!)
- New-grad-friendly postings

Everything runs in the browser. Nothing is sent anywhere, and your profile is saved in localStorage.

Built by [Ishmeen Garewal](https://ishmeen-11.github.io/Ishmeen-Portfolio/).

## Smart mode (AI)

On Netlify, a serverless function (`netlify/functions/decode.mjs`) sends the posting and your profile to Claude, which reads each requirement line and returns a structured check (meets / partial / missing / blocker) along with a one-line "your angle" tip. If the function isn't available, the page falls back to the built-in rule-based parser.

**Setup:** in Netlify, go to Site configuration → Environment variables and add `ANTHROPIC_API_KEY`. You can optionally set `ANTHROPIC_MODEL` too (the default is `claude-haiku-5-5`).

## Run locally

```bash
npm i -g netlify-cli
netlify dev   # serves the page + function at localhost:8888
```
