---
name: resume-match-score-improvement
description: Match a resume against a specific job description (JD), produce a calibrated fit score with a breakdown, and suggest honest, copy-paste-ready edits that quote the exact current line and the exact replacement. Use when the user wants to tailor or score a resume to a JD, find gaps, or get precise wording changes. Hard rules — never invent skills/experience the candidate lacks, and never add bragging or inflated claims.
---

# Resume ↔ JD Match, Score & Improvement

Match a candidate's resume against one job description, score the fit, and propose
**exact** wording edits — without inventing skills the candidate doesn't have and
without adding bragging or inflated claims.

## When to use
Trigger when the user asks to: "score my resume against this job", "tailor my
resume to this JD", "where do I fall short for this role", "what should I change
to match this posting", or similar.

## Inputs (gather both; do not guess)
1. **Resume** — a file path, pasted text, or `.docx`. For `.docx`, extract text:
   `unzip -p resume.docx word/document.xml | grep -o '<w:t[^>]*>[^<]*</w:t>' | sed 's/<[^>]*>//g'`
2. **Job description (JD)** — pasted text, a file, or a URL (fetch it). If only a
   role title is given, **ask for the JD or its key requirements**. Never fabricate a JD.

If either input is missing, ask for it before scoring.

## Step 1 — Parse the JD
Extract and list, verbatim where possible:
- **Must-have** requirements (skills, tools, years, domain, education).
- **Preferred / nice-to-have**.
- **Core responsibilities**.
- **Seniority & scope** signals (IC level, lead, manage, architect, on-call, etc.).
- **ATS keywords** — the exact terms an automated screen would match on.

## Step 2 — Parse the resume (this is the source of truth)
Extract the candidate's actual evidence: skills, tools, titles, years, domains,
quantified achievements. The candidate **only "has" what is written or clearly
implied**. Anything not supported by the resume does not exist for scoring.

## Step 3 — Match
Classify every JD requirement:
- ✅ **Covered** — quote the exact resume line that satisfies it.
- 🟡 **Partial** — present but weak, buried, implicit, or worded differently; note where.
- ❌ **Missing** — genuinely absent from the resume.
Do not mark anything "Covered" unless the resume actually supports it.

## Step 4 — Score (calibrated 0–100, not generous)
Weighted:
| Category | Weight |
|---|---|
| Must-have coverage | 50 |
| Responsibilities / experience alignment | 25 |
| Keyword / ATS match | 15 |
| Seniority / scope fit | 10 |

Output the total and the per-category sub-scores, each with a one-line rationale.
Penalize missing must-haves heavily. A resume that omits a required must-have
cannot score in the top band, however strong elsewhere.

## Step 5 — Suggest improvements (exact edits only)
For each fixable item, output a precise, copy-paste-ready edit:
- **Where:** section + the exact current line, quoted verbatim.
- **Replace:** the exact word/phrase/line to remove.
- **With:** the exact replacement text.
- **Why:** one line tying it to a specific JD requirement.

Use this shape:

> **[Experience → Brevo, bullet 2]**
> Replace: `Worked on Kafka systems`
> With: `Built Kafka consumer pipelines with retry/DLQ for transactional messaging`
> Why: JD lists "event-driven architecture (Kafka)" as a must-have; the candidate
> already did this — this surfaces it in the JD's terms.

## HARD RULES for every suggestion
1. **No skill invention.** Never suggest adding a skill, tool, certification, or
   experience the candidate doesn't actually have. If the JD needs something the
   resume lacks, put it under **Genuine gaps** — never fabricate it into the resume.
2. **No bragging / inflation.** Keep edits factual and measured. Do not add
   superlatives ("world-class", "expert", "guru", "rockstar", "passionate"),
   do not inflate numbers, and do not claim scope or seniority the resume
   doesn't support. Prefer concrete, verifiable phrasing over adjectives.
3. **Only rephrase, surface, or quantify what is TRUE.** Good edits: mirror the
   JD's exact keyword for a skill the candidate genuinely has; move a buried real
   skill up; replace a vague line with a specific real achievement the candidate
   actually did; add the exact term alongside an abbreviation the candidate uses
   (`K8s` → `Kubernetes (K8s)`).
4. **Exactness is mandatory.** Every edit must quote the exact old text and give
   the exact new text. No vague advice like "make it stronger".

## Output format
1. **Match score:** `NN/100` + the per-category breakdown.
2. **Coverage table:** ✅ Covered / 🟡 Partial / ❌ Missing (with resume citations).
3. **Exact edits:** the `Replace → With` list (with location + why).
4. **Genuine gaps:** honest list of JD requirements the resume can't truthfully
   claim, with optional honest ways to address (learn it, lean on transferable
   experience, omit if irrelevant) — no fabrication.
5. **(Optional) ATS keyword checklist:** present vs. missing exact terms the
   candidate *legitimately* has.

## Don'ts (restate)
- Don't invent skills or experience.
- Don't add bragging, hype, or unverifiable claims.
- Don't give vague edits — always exact line + exact word.
- Don't fabricate a JD; ask if it's missing.
