import type { OutingFixture, OutingInputs } from './model';

export const defaultInputs: OutingInputs = {
  origin: 'kowloon',
  departureMinutes: 17 * 60,
  homeByMinutes: 23 * 60 + 30,
  budgetPerPersonHKD: 400,
  partySize: 2,
  mealMinutes: 90,
  weights: { price: 3, ease: 3, discovery: 3 },
  szRoute: 'rail',
  fxHKDPerCNY: 1.09,
  crossingClosingBufferMinutes: 15,
  hkMealPerPersonHKD: 248,
  szMealPerPersonCNY: 128,
  walkMinutes: 45,
  entryEligibility: 'unsure',
  familiarity: { hk: { dinner: 'unsure', walk: 'unsure' }, sz: { dinner: 'unsure', walk: 'unsure' } },
};

/** Authored example numbers. No fare, restaurant price, FX quote or journey time is live. */
export const illustrativeData: OutingFixture = {
  dataStatus: 'illustrative',
  statusLabel: 'Illustrative inputs · prices, FX and travel times are unverified',
  assumptionNotes: [
    'Dinner, drinks, shared food, transfers and walking are authored demo assumptions, not venue quotes.',
    'Travel includes one outward and one return journey plus a border buffer each way. Actual queues may exceed the buffer.',
    'Crossing opening hours do not verify train or bus timetables, seat availability, restaurant hours or immigration eligibility.',
    'Both Hong Kong and Shenzhen use UTC+8. A home-by clock time earlier than departure means the next day.',
    'Budget is HKD per person. Shared food is charged once to the group, then divided by party size.',
    'Budgets and native unit prices round to cents once, with decimal half-cents rounded up. Converted group line items round to HKD cents before addition; per-person figures are rounded averages.',
    'Unedited journey assumptions follow the selected origin and route. An explicit time override stays in effect until reset, including when the route or origin changes.',
    'Discovery uses only your explicit new / familiar answers for selected activities. Not sure stays unknown; neither city has an intrinsic novelty rating.',
  ],
  local: {
    label: 'Stay in Hong Kong',
    description: 'A neighborhood dinner and a harbor-side walk',
    walkMinutes: 45,
    origins: {
      kowloon: { travelMinutesEachWay: 15, fareEachWayHKD: 12 },
      island: { travelMinutesEachWay: 20, fareEachWayHKD: 15 },
    },
    costs: [
      { id: 'hk-dinner', label: 'Dinner', currency: 'HKD', amount: 248, quantity: 1, scope: 'per-person', note: 'Illustrative meal allowance per person.' },
      { id: 'hk-drinks', label: 'Drinks', currency: 'HKD', amount: 32, quantity: 1, scope: 'per-person', note: 'Illustrative drinks allowance per person.' },
      { id: 'hk-shared', optionalSharedOrder: true, label: 'Shared dessert', currency: 'HKD', amount: 64, quantity: 1, scope: 'group', note: 'One fixed dessert order for the group; adjust in the fixture if the order changes.' },
    ],
  },
  shenzhen: {
    label: 'Head to Shenzhen',
    description: 'Dinner in Luohu and a city-neighborhood walk',
    walkMinutes: 45,
    costs: [
      { id: 'sz-dinner', label: 'Dinner', currency: 'CNY', amount: 128, quantity: 1, scope: 'per-person', note: 'Illustrative meal allowance per person.' },
      { id: 'sz-drinks', label: 'Drinks', currency: 'CNY', amount: 18, quantity: 1, scope: 'per-person', note: 'Illustrative drinks allowance per person.' },
      { id: 'sz-shared', optionalSharedOrder: true, label: 'Shared dishes', currency: 'CNY', amount: 58, quantity: 1, scope: 'group', note: 'One fixed shared order for the group; adjust in the fixture if the order changes.' },
    ],
    routes: {
      rail: {
        label: 'Rail via Lo Wu',
        crossing: 'Lo Wu rail crossing',
        openingMinutes: 6 * 60 + 30,
        closingMinutes: 24 * 60,
        twentyFourHours: false,
        origins: {
          kowloon: { toCrossingMinutes: 50, fromCrossingMinutes: 50, fareEachWayHKD: 44 },
          island: { toCrossingMinutes: 65, fromCrossingMinutes: 65, fareEachWayHKD: 55 },
        },
        destinationTransferMinutesEachWay: 25,
        borderBufferMinutesEachWay: 30,
        destinationFareEachWayCNY: 6,
      },
      bus: {
        label: 'Bus via Lok Ma Chau road crossing',
        crossing: 'Lok Ma Chau road crossing',
        openingMinutes: 0,
        closingMinutes: 24 * 60,
        twentyFourHours: true,
        origins: {
          kowloon: { toCrossingMinutes: 65, fromCrossingMinutes: 65, fareEachWayHKD: 75 },
          island: { toCrossingMinutes: 80, fromCrossingMinutes: 80, fareEachWayHKD: 95 },
        },
        destinationTransferMinutesEachWay: 35,
        borderBufferMinutesEachWay: 35,
        destinationFareEachWayCNY: 8,
      },
    },
  },
  crossingHoursSource: {
    title: 'Hong Kong Immigration Department · Control points',
    url: 'https://www.immd.gov.hk/eng/contactus/control_points.html',
    checkedDate: '2026-10-06',
    note: 'Official page dated 26 June 2026: Lo Wu 06:30–00:00; Lok Ma Chau road crossing 24 hours. The separate Lok Ma Chau Spur Line is 06:30–22:30 and is not the rail route modeled here.',
  },
};
