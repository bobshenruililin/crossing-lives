/** Institutional descriptions only. This module has no outing, price or allocation inputs. */
export type MembershipTopicId = 'customer-access' | 'worker-decisions' | 'surplus';
export type MembershipCaseId = 'home-market' | 'cheese-board';
export type MembershipSourceId = 'home-about' | 'home-membership' | 'cheese-about' | 'cheese-hiring-2022';
export type MembershipEvidenceStatus = 'documented' | 'not-established' | 'documented-with-historical-detail' | 'historical';

export interface MembershipSource {
  readonly title: string;
  readonly linkLabel: string;
  readonly href: string;
  readonly date: string;
  readonly checked: '2026-10-06';
  readonly retrieval: string;
  readonly limit: string;
}

export interface MembershipReading {
  readonly caseId: MembershipCaseId;
  readonly status: MembershipEvidenceStatus;
  readonly answer: string;
  readonly limit: string;
  readonly evidenceLabel: string;
  readonly sourceIds: readonly MembershipSourceId[];
}

export interface MembershipTopic {
  readonly id: MembershipTopicId;
  readonly label: string;
  readonly question: string;
  readonly readings: readonly MembershipReading[];
  readonly dueDiligence: string;
}

export const membershipCases = {
  'home-market': 'Home Market · Hong Kong',
  'cheese-board': 'The Cheese Board Collective · Berkeley',
} as const satisfies Record<MembershipCaseId, string>;

export const membershipStatusLabels = {
  documented: 'Described by official sources',
  'not-established': 'Not established by reviewed sources',
  'documented-with-historical-detail': 'Official description + historical 2022 detail',
  historical: 'Historical 2022 detail',
} as const satisfies Record<MembershipEvidenceStatus, string>;

export const membershipBoundary = 'Two organizations, different settings. These sources document rights, not comparative financial outcomes. Neither describes tonight’s fictional businesses.';

export const membershipSources: Readonly<Record<MembershipSourceId, MembershipSource>> = {
  'home-about': {
    title: 'Home Market: About Us',
    linkLabel: 'About Us',
    href: 'https://www.homemarket.hk/en/about_us.php',
    date: 'Undated official page',
    checked: '2026-10-06',
    retrieval: 'Direct page text retrieved; publication/update date not stated. Crawl metadata indicated the previous month, not a publication date.',
    limit: 'Organizational self-description; legal ownership, control and long-term funding dependence were not verified.',
  },
  'home-membership': {
    title: 'Home Market: How to Join',
    linkLabel: 'How to Join',
    href: 'https://www.homemarket.hk/en/become_member.php',
    date: 'Undated official page',
    checked: '2026-10-06',
    retrieval: 'Mixed-language page text retrieved; official-domain English indexed text corroborated the member-benefit description.',
    limit: 'The reviewed pages do not establish customer ownership shares or worker voting rights.',
  },
  'cheese-about': {
    title: 'The Cheese Board Collective: About Us',
    linkLabel: 'About Us',
    href: 'https://cheeseboardcollective.coop/about-us/about-main/',
    date: 'Undated official page',
    checked: '2026-10-06',
    retrieval: 'Direct open timed out. Official-domain indexed page text, marked crawled on the check date, supplied the description.',
    limit: 'Institutional self-description, not independent evidence of outcomes or audited finances.',
  },
  'cheese-hiring-2022': {
    title: 'The Cheese Board Collective: 2022 hiring notice',
    linkLabel: '2022 hiring notice (PDF)',
    href: 'https://cheeseboardcollective.coop/wp-content/uploads/2022/09/Collective-Hiring-Notice-202200930.pdf',
    date: 'Historical 2022 notice; internal application deadline 24 October 2022; exact publication day unknown',
    checked: '2026-10-06',
    retrieval: 'Direct PDF open failed. Official-domain indexed PDF text exposed the relevant passages and internal deadline; inconsistent search publication metadata was not used.',
    limit: 'Page 1: candidacy and meetings. Page 2: hours-based profit shares. Current terms, amounts, reserves, losses, exit conditions and audited finances were not verified.',
  },
};

export const membershipTopics: readonly MembershipTopic[] = [
  {
    id: 'customer-access',
    label: 'Customer access',
    question: 'What benefit does a customer receive?',
    readings: [
      {
        caseId: 'home-market',
        status: 'documented',
        answer: 'Customer membership provides special prices and benefits. Home Market describes foundation funding and goods sold close to cost.',
        limit: 'These pages do not establish customer ownership shares.',
        evidenceLabel: 'Official pages · undated · checked 6 October 2026',
        sourceIds: ['home-about', 'home-membership'],
      },
      {
        caseId: 'cheese-board',
        status: 'not-established',
        answer: 'The reviewed sources describe worker membership; they do not establish a customer membership benefit.',
        limit: 'An evidence gap does not mean customer benefits cannot exist.',
        evidenceLabel: 'Official About page · undated; historical 2022 hiring notice · checked 6 October 2026',
        sourceIds: ['cheese-about', 'cheese-hiring-2022'],
      },
    ],
    dueDiligence: 'What funds the price benefit, and how durable is that funding?',
  },
  {
    id: 'worker-decisions',
    label: 'Worker decisions',
    question: 'What decision rights do workers have?',
    readings: [
      {
        caseId: 'home-market',
        status: 'not-established',
        answer: 'The reviewed pages do not establish worker voting rights or worker ownership.',
        limit: 'Undisclosed here does not mean workers have no voice.',
        evidenceLabel: 'Official pages · undated · checked 6 October 2026',
        sourceIds: ['home-about', 'home-membership'],
      },
      {
        caseId: 'cheese-board',
        status: 'documented-with-historical-detail',
        answer: 'Its About page describes equal worker ownership and control. A 2022 hiring notice described mandatory business meetings using modified consensus.',
        limit: 'The notice required six-month candidacy, not automatic membership. Candidates’ exact rights and current admission or meeting rules were not verified.',
        evidenceLabel: 'Official About page · undated; historical 2022 hiring notice, p. 1 · checked 6 October 2026',
        sourceIds: ['cheese-about', 'cheese-hiring-2022'],
      },
    ],
    dueDiligence: 'Who can approve a major change, and who is still outside membership?',
  },
  {
    id: 'surplus',
    label: 'Surplus',
    question: 'Who has a documented claim on surplus?',
    readings: [
      {
        caseId: 'home-market',
        status: 'not-established',
        answer: 'The reviewed pages do not specify ownership-based distributions. Member price benefits do not establish a claim on business surplus.',
        limit: 'Distribution rules and audited finances were not verified.',
        evidenceLabel: 'Official pages · undated · checked 6 October 2026',
        sourceIds: ['home-about', 'home-membership'],
      },
      {
        caseId: 'cheese-board',
        status: 'historical',
        answer: 'A 2022 hiring notice described worker-owner profit shares based on hours worked.',
        limit: 'Amounts, retained reserves, current terms and audited finances were not verified.',
        evidenceLabel: 'Official hiring notice, p. 2 · historical 2022 detail · checked 6 October 2026',
        sourceIds: ['cheese-hiring-2022'],
      },
    ],
    dueDiligence: 'What remains after costs and reserves, and who decides its use?',
  },
];
