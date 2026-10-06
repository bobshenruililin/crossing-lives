import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  membershipBoundary,
  membershipCases,
  membershipSources,
  membershipStatusLabels,
  membershipTopics,
} from '../src/business/membership-evidence';
import type { MembershipTopicId } from '../src/business/membership-evidence';
import { createSpendingContext } from '../src/business/context';
import type { SpendingContext } from '../src/business/context';
import EvidenceDesk from '../src/components/EvidenceDesk';
import MembershipLens, { MembershipReading } from '../src/components/MembershipLens';
import { defaultInputs, illustrativeData } from '../src/domain/data';
import { compareOutings } from '../src/domain/engine';

const topic = (id: MembershipTopicId) => membershipTopics.find(item => item.id === id)!;
const reading = (id: MembershipTopicId, caseId: 'home-market' | 'cheese-board') => topic(id).readings.find(item => item.caseId === caseId)!;
const renderBusiness = (spendingContext: SpendingContext | null = null) => renderToStaticMarkup(createElement(EvidenceDesk, {
  onBack: () => {}, initialSection: 'economics', spendingContext,
}));
const lensMarkup = (html: string) => html.slice(html.indexOf('<details class="membership-lens">'), html.indexOf('<p class="business-pool-boundary">'));
const poolMarkup = (html: string) => html.match(/<details class="surplus-lab">[\s\S]*?<\/details>/)?.[0];

test('membership ledger preserves all four exact official sources and the check date', () => {
  assert.deepEqual(Object.keys(membershipSources), ['home-about', 'home-membership', 'cheese-about', 'cheese-hiring-2022']);
  assert.deepEqual(Object.values(membershipSources).map(source => source.href), [
    'https://www.homemarket.hk/en/about_us.php',
    'https://www.homemarket.hk/en/become_member.php',
    'https://cheeseboardcollective.coop/about-us/about-main/',
    'https://cheeseboardcollective.coop/wp-content/uploads/2022/09/Collective-Hiring-Notice-202200930.pdf',
  ]);
  for (const source of Object.values(membershipSources)) {
    assert.equal(source.checked, '2026-10-06');
    assert.ok(source.title && source.retrieval && source.limit);
  }
  for (const id of ['home-about', 'home-membership', 'cheese-about'] as const) {
    assert.equal(membershipSources[id].date, 'Undated official page');
  }
});

test('historical evidence uses the internal 2022 deadline and honest indexed-text provenance', () => {
  const hiring = membershipSources['cheese-hiring-2022'];
  assert.match(hiring.date, /Historical 2022 notice; internal application deadline 24 October 2022; exact publication day unknown/);
  assert.match(hiring.retrieval, /Direct PDF open failed/);
  assert.match(hiring.retrieval, /Official-domain indexed PDF text/);
  assert.match(hiring.retrieval, /inconsistent search publication metadata was not used/);
  assert.match(hiring.limit, /Current terms, amounts, reserves, losses, exit conditions and audited finances were not verified/);
  assert.match(membershipSources['cheese-about'].retrieval, /Direct open timed out\. Official-domain indexed page text/);
  assert.match(membershipSources['home-membership'].retrieval, /Mixed-language page text/);
  assert.match(membershipSources['home-about'].retrieval, /not a publication date/);
});

test('each of three topics has two distinct cases, valid provenance and one due-diligence question', () => {
  assert.deepEqual(membershipTopics.map(item => item.id), ['customer-access', 'worker-decisions', 'surplus']);
  assert.deepEqual(membershipTopics.map(item => item.label), ['Customer access', 'Worker decisions', 'Surplus']);
  for (const item of membershipTopics) {
    assert.deepEqual(item.readings.map(row => row.caseId), ['home-market', 'cheese-board']);
    assert.equal((item.dueDiligence.match(/\?/g) ?? []).length, 1);
    for (const row of item.readings) {
      assert.ok(membershipStatusLabels[row.status]);
      assert.ok(row.answer && row.limit);
      assert.ok(row.sourceIds.length);
      assert.equal(new Set(row.sourceIds).size, row.sourceIds.length);
      assert.match(row.evidenceLabel, /checked 6 October 2026/);
      for (const sourceId of row.sourceIds) assert.ok(membershipSources[sourceId]);
    }
  }
});

test('customer access separates documented benefits from ownership and unknown customer arrangements', () => {
  const home = reading('customer-access', 'home-market');
  assert.equal(home.status, 'documented');
  assert.match(home.answer, /special prices and benefits/);
  assert.match(home.answer, /foundation funding and goods sold close to cost/);
  assert.match(home.limit, /do not establish customer ownership shares/);
  const cheese = reading('customer-access', 'cheese-board');
  assert.equal(cheese.status, 'not-established');
  assert.match(cheese.answer, /do not establish a customer membership benefit/);
  assert.match(cheese.limit, /does not mean customer benefits cannot exist/);
});

test('worker rights keep unknown distinct from absence and candidacy distinct from automatic membership', () => {
  const home = reading('worker-decisions', 'home-market');
  assert.equal(home.status, 'not-established');
  assert.match(home.answer, /do not establish worker voting rights or worker ownership/);
  assert.match(home.limit, /does not mean workers have no voice/);
  const cheese = reading('worker-decisions', 'cheese-board');
  assert.equal(cheese.status, 'documented-with-historical-detail');
  assert.match(cheese.answer, /equal worker ownership and control/);
  assert.match(cheese.answer, /2022 hiring notice described mandatory business meetings using modified consensus/);
  assert.match(cheese.limit, /six-month candidacy, not automatic membership/);
  assert.match(cheese.limit, /Candidates’ exact rights and current admission or meeting rules were not verified/);
  assert.match(cheese.evidenceLabel, /historical 2022 hiring notice, p\. 1/);
});

test('surplus evidence supplies a historical rule without invented amounts, reserves or current terms', () => {
  const home = reading('surplus', 'home-market');
  assert.equal(home.status, 'not-established');
  assert.match(home.answer, /Member price benefits do not establish a claim on business surplus/);
  assert.match(home.limit, /Distribution rules and audited finances were not verified/);
  const cheese = reading('surplus', 'cheese-board');
  assert.equal(cheese.status, 'historical');
  assert.match(cheese.answer, /2022 hiring notice described worker-owner profit shares based on hours worked/);
  assert.match(cheese.limit, /Amounts, retained reserves, current terms and audited finances were not verified/);
  assert.match(cheese.evidenceLabel, /p\. 2 · historical 2022 detail/);
  assert.deepEqual(cheese.sourceIds, ['cheese-hiring-2022']);
});

test('the optional lens starts closed with a native labelled one-choice radio group', () => {
  const html = renderToStaticMarkup(createElement(MembershipLens));
  assert.match(html, /^<details class="membership-lens"><summary><h2>What does membership let you do\?<\/h2><\/summary>/);
  assert.match(html, /<fieldset class="membership-topics"><legend>Choose a membership question<\/legend>/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
  assert.match(html, /checked="" value="customer-access"/);
  assert.equal(new Set([...html.matchAll(/name="(membership-topic-[^"]+)"/g)].map(match => match[1])).size, 1);
  assert.match(html, /<details class="membership-sources"><summary>Sources and limits · checked 6 October 2026<\/summary>/);
  assert.doesNotMatch(html, /\sopen(?:=|>)/);
});

test('every active reading renders exactly two semantic rows and all adjacent limits, dates and links', () => {
  for (const item of membershipTopics) {
    const html = renderToStaticMarkup(createElement(MembershipReading, { topic: item }));
    assert.match(html, /<section class="membership-reading" aria-labelledby="[^"]+"><h3 id="[^"]+">/);
    assert.ok(html.includes(item.question));
    assert.equal((html.match(/class="membership-reading-row"/g) ?? []).length, 2);
    assert.equal((html.match(/class="membership-limit"/g) ?? []).length, 2);
    assert.equal((html.match(/class="membership-citation"/g) ?? []).length, 2);
    assert.equal((html.match(/class="membership-question"/g) ?? []).length, 1);
    assert.equal((html.match(/Before adapting this model/g) ?? []).length, 1);
    for (const row of item.readings) {
      assert.ok(html.includes(`<h4>${membershipCases[row.caseId]}</h4>`));
      assert.ok(html.includes(membershipStatusLabels[row.status]));
      assert.ok(html.includes(row.answer));
      assert.ok(html.includes(row.limit));
      assert.ok(html.includes(row.evidenceLabel));
      for (const sourceId of row.sourceIds) assert.ok(html.includes(`href="${membershipSources[sourceId].href}"`));
    }
    assert.ok(html.includes(item.dueDiligence));
    assert.doesNotMatch(html, /<details|<input|HK\$|CNY|allocation-|score/);
  }
});

test('sources disclosure includes all dates, retrieval limits and direct official links', () => {
  const html = renderToStaticMarkup(createElement(MembershipLens));
  const sources = html.slice(html.indexOf('<details class="membership-sources">'));
  for (const source of Object.values(membershipSources)) {
    assert.ok(sources.includes(`href="${source.href}"`));
    assert.ok(sources.includes(source.title));
    assert.ok(sources.includes(source.date));
    assert.ok(sources.includes(source.retrieval));
    assert.ok(sources.includes(source.limit));
  }
  assert.match(sources, /current terms were not verified/);
});

test('different institutions and fictional-business boundaries stay outside the source disclosure', () => {
  const html = renderToStaticMarkup(createElement(MembershipLens));
  const beforeSources = html.slice(0, html.indexOf('<details class="membership-sources">'));
  assert.ok(beforeSources.includes(membershipBoundary));
  assert.match(beforeSources, /Two organizations, different settings/);
  assert.match(beforeSources, /not comparative financial outcomes/);
  assert.match(beforeSources, /Neither describes tonight’s fictional businesses/);
});

test('membership data and component have no dinner inputs, numerical business estimates or persistence', () => {
  const dataText = readFileSync(new URL('../src/business/membership-evidence.ts', import.meta.url), 'utf8');
  const componentText = readFileSync(new URL('../src/components/MembershipLens.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dataText, /^import /m);
  assert.match(componentText, /function MembershipLens\(\)/);
  assert.doesNotMatch(componentText, /from ['"].*(?:context|domain|story|SurplusLab)|spendingContext|localStorage|sessionStorage|fetch\(|allocateSurplus|compareOutings/);
  const values = JSON.stringify({ membershipTopics, membershipSources });
  assert.doesNotMatch(values, /perPersonHKD|groupHKD|poolHKD|allocationCents|partySize|HK\$|eligibility|income threshold|disability|welfare/);
  const numericValues = (value: unknown): number[] => typeof value === 'number' ? [value]
    : value && typeof value === 'object' ? Object.values(value).flatMap(numericValues) : [];
  assert.deepEqual(numericValues(membershipTopics), []);
  assert.deepEqual(numericValues(membershipSources), []);
});

test('lens and independent fixed pool remain identical across both cities, all party sizes and incomplete costs', () => {
  const generic = renderBusiness();
  const initialLens = lensMarkup(generic);
  const initialPool = poolMarkup(generic);
  assert.ok(initialLens && initialPool);
  assert.match(initialPool, /Hypothetical pool · HKD/);
  assert.match(initialPool, /value="120"/);
  assert.match(initialPool, /HK\$60\.00/);
  assert.match(initialPool, /HK\$24\.00/);
  assert.match(initialPool, /HK\$36\.00/);
  for (const partySize of [1, 2, 3, 4, 5, 6]) {
    const result = compareOutings({ ...defaultInputs, partySize }, illustrativeData);
    for (const option of result.options) {
      const context = createSpendingContext(option, partySize)!;
      for (const candidate of [context, { ...context, perPersonHKD: null, groupHKD: null }]) {
        const html = renderBusiness(candidate);
        assert.equal(lensMarkup(html), initialLens);
        assert.equal(poolMarkup(html), initialPool);
        for (const question of ['What explains the price?', 'Who keeps the margin?', 'What might change?']) assert.ok(html.includes(question));
        assert.match(html, /The fixed-pool exercise below is a separate hypothetical amount\. It is not calculated from this outing estimate\./);
      }
    }
  }
});

test('the optional lens appears only in Business questions, before the scaffold questions and separate pool', () => {
  const business = renderBusiness();
  assert.ok(business.indexOf('<details class="membership-lens">') < business.indexOf('<div class="business-grid">'));
  assert.ok(business.indexOf('<div class="research-banner">') < business.indexOf('<details class="membership-lens">')); 
  assert.ok(business.indexOf('<details class="membership-lens">') < business.indexOf('<p class="business-pool-boundary">'));
  assert.ok(business.indexOf('<p class="business-pool-boundary">') < business.indexOf('<details class="surplus-lab">'));
  for (const initialSection of ['sources', 'roadmap'] as const) {
    const html = renderToStaticMarkup(createElement(EvidenceDesk, { onBack: () => {}, initialSection }));
    assert.doesNotMatch(html, /class="membership-lens"|Choose a membership question/);
  }
});
