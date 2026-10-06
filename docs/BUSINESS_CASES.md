# Optional membership-rights lens

Evidence snapshot checked **6 October 2026**. All case copy is paraphrase. This document records the sources and limits behind the optional “What does membership let you do?” disclosure in Business questions.

## Purpose and boundary

The lens asks one practical question at a time: customer access, worker decisions or a documented claim on surplus. Two short reading rows and one due-diligence question distinguish customer benefits from worker ownership without ranking the organizations.

Home Market in Hong Kong and The Cheese Board Collective in Berkeley are different organizations in different settings. Their descriptions establish particular arrangements, not a like-for-like financial comparison, causal evidence or proof of better outcomes. Neither case represents the fictional dinner businesses. No price, return, allocation rate or governance model is transferred to the dinner scenario.

The lens is additive and initially closed. It follows the spending context, before the generic research questions, so documented evidence is easy to find. The unchanged, independently labelled hypothetical fixed-pool exercise remains separate. The lens accepts no spending context and imports no dinner engine, allocation or persistence code. Changing a question changes only local reading state. There is no score, winner, new AI service or simulation.

## Reading matrix

### Customer access: What benefit does a customer receive?

- **Home Market:** Official pages describe special member prices and benefits, foundation funding and goods sold close to cost. These pages do not establish customer ownership shares.
- **Cheese Board:** The reviewed sources describe worker membership. They do not establish a customer membership benefit. This is a limit of reviewed evidence, not a finding that customer benefits cannot exist.
- **Before adapting the model:** What funds the price benefit, and how durable is that funding?

### Worker decisions: What decision rights do workers have?

- **Home Market:** Worker voting rights and worker ownership are not established by the reviewed pages. Undisclosed here does not mean workers have no voice.
- **Cheese Board:** The About page describes equal worker ownership and control. A historical 2022 hiring notice describes mandatory business meetings using modified consensus and six-month candidacy before membership. Candidacy does not establish automatic admission after six months or candidates’ exact decision rights. Current admission and meeting rules were not verified.
- **Before adapting the model:** Who can approve a major change, and who is still outside membership?

### Surplus: Who has a documented claim on surplus?

- **Home Market:** The reviewed pages do not specify ownership-based distributions. Member price benefits do not establish a claim on business surplus. Distribution rules and audited finances were not verified.
- **Cheese Board:** Page 2 of the historical 2022 hiring notice describes worker-owner profit shares based on hours worked. Amounts, retained reserves, current terms and audited finances were not verified.
- **Before adapting the model:** What remains after costs and reserves, and who decides its use?

## Source ledger

### Home Market: About Us

- URL: https://www.homemarket.hk/en/about_us.php
- Date: Undated official page; checked 6 October 2026. No precise publication or update date was established.
- Supports: Nonprofit self-description, Lee Shau Kee Foundation funding and goods sold close to cost.
- Retrieval: Direct page text retrieved; publication/update date not stated. Retrieval metadata described a crawl from the previous month; this is not a known update date, interview or audited verification.
- Scope: The organization's account of its arrangements. The legal ownership/control chain and long-term subsidy dependence were not established or quantified.

### Home Market: How to Join

- URL: https://www.homemarket.hk/en/become_member.php
- Date: Undated official page; checked 6 October 2026. No precise publication or update date was established.
- Supports: Customer membership provides special member prices and benefits.
- Retrieval: The retrieved page included mixed-language text. An official-domain English indexed result independently corroborated the membership-benefit language. Irrelevant external asset links were ignored.
- Scope: The reviewed pages do not establish ownership shares or worker voting rights. An evidence gap is not proof of absent rights. Membership eligibility or private categories are intentionally not reproduced.

### The Cheese Board Collective: About Us

- URL: https://cheeseboardcollective.coop/about-us/about-main/
- Date: Undated official page; checked 6 October 2026.
- Supports: Transition to employee ownership in 1971 and equal worker ownership and control over resources and work.
- Retrieval: Direct open timed out. Official-domain indexed page text, marked crawled on the check date, supplied the statements. This was not a successful direct fetch.
- Scope: Current institutional self-description, not an independent evaluation of outcomes or audited finances.

### The Cheese Board Collective: hiring notice

- URL: https://cheeseboardcollective.coop/wp-content/uploads/2022/09/Collective-Hiring-Notice-202200930.pdf
- Date: Historical 2022 notice, established by its internal application deadline of **24 October 2022**. Exact publication day was not established; the filename alone is insufficient.
- Supports: Page 1 describes six-month candidacy before membership and mandatory modified-consensus business meetings. Page 2 describes worker-owner profit sharing based on hours worked.
- Retrieval: Direct PDF open failed. Official-domain indexed PDF text independently exposed the relevant passages and internal 2022 deadline. Search-engine publication metadata was inconsistent with the document date and was not used.
- Scope: Historical operating terms. Current candidacy, admission, meeting rules, profit-sharing terms, amounts, reserves, losses, exit conditions and audited finances were not verified. Candidacy does not guarantee automatic membership.

## Implementation and verification boundaries

- Data: `src/business/membership-evidence.ts` contains typed topics, source references and explicit statuses: documented, not established, documented with historical detail, or historical. “Documented” refers to the organization's description; it does not imply an independent audit.
- Rendering: `src/components/MembershipLens.tsx` provides native radio controls and semantic reading headings. Immediate claim limits, historical labels, source dates and direct links stay adjacent to the selected answer. Retrieval details are available in one nested Sources disclosure.
- Integration: `EvidenceDesk` inserts the optional lens without passing any dinner totals. The existing three business questions, spending boundary and `SurplusLab` markup remain intact.
- Unit/render tests: `tests/membership-evidence.test.ts` checks all sources and topics, unknown-versus-absent distinctions, historical provenance, candidacy limits, closed initial state, semantic rows, all direct links, source details, absence of numeric coupling and identical independent-pool markup across both cities, all party sizes and incomplete totals.
- Browser layout, keyboard, accessibility, portable export and release evidence are separate verification work. Unit/render checks alone do not establish those results.

Future source updates should preserve date uncertainty and retrieval honesty. A newer URL or filename is not a publication date. Do not claim worker ownership causes higher profits, lower prices, belonging or happiness. Worker ownership also does not erase wages, rent, reserves, debt or losses.
