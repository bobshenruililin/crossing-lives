// Public-safe standalone content. No model imports or browser side effects.
export const WORLD_CONTENT = {
  "schemaVersion": "crossing-lives-world-content-v1",
  "authoredOn": "2026-10-07",
  "publicNotice": "Original fictional scenes and small what-ifs. Figures marked as examples are not live prices, routes or forecasts.",
  "presentation": {
    "maxPrimaryThoughtWords": 35,
    "maxKeyNumbers": 2,
    "maxActiveInteractions": 1,
    "worldRemainsVisible": true,
    "evidenceExpandedByDefault": false,
    "navigationIsIllustrative": true
  },
  "setup": {
    "defaultParty": "two-friends",
    "defaultScenario": "fieldtrip",
    "defaultDay": "weekend",
    "playLabel": "Play",
    "parties": [
      {
        "id": "two-friends",
        "label": "Two friends",
        "presentationOnly": true
      },
      {
        "id": "solo",
        "label": "Solo",
        "presentationOnly": true
      },
      {
        "id": "couple",
        "label": "Couple",
        "presentationOnly": true
      },
      {
        "id": "older-couple",
        "label": "Older couple",
        "presentationOnly": true
      },
      {
        "id": "family",
        "label": "Family",
        "presentationOnly": true,
        "composition": {
          "adults": 2,
          "children": 1
        }
      }
    ],
    "scenarios": [
      {
        "id": "fieldtrip",
        "label": "Explore the city"
      },
      {
        "id": "daily-life",
        "label": "Everyday life"
      },
      {
        "id": "housing",
        "label": "Find a home"
      }
    ],
    "days": [
      {
        "id": "weekday",
        "label": "Weekday"
      },
      {
        "id": "weekend",
        "label": "Weekend"
      }
    ],
    "guardrail": "Party, day and scenario select fictional context and appearance only. They do not infer preferences, fares, mobility, earnings or permissions. The family has two fictional adults and one child; child fare treatment remains unknown."
  },
  "sceneOrder": [
    "hk-home",
    "metro-carriage",
    "border-arrival",
    "parcel-counter",
    "mall-foodcourt",
    "neighborhood-lane",
    "urban-village",
    "rental-home",
    "luxury-home",
    "office-floor",
    "learning-center",
    "planning-museum"
  ],
  "scenes": {
    "hk-home": {
      "id": "hk-home",
      "sceneId": "hk-home",
      "title": "A day begins",
      "placeLabel": "Hong Kong · fictional home",
      "pointLabel": "Home-by clock",
      "thought": "Where could today take us? Keep the way home in the picture before stepping outside.",
      "primaryThought": "Where could today take us? Keep the way home in the picture before stepping outside.",
      "interactionId": "hk-home",
      "action": {
        "interactionId": "hk-home",
        "question": "When do you want to be home?",
        "input": {
          "kind": "choice",
          "label": "Turn the home-by clock",
          "defaultValue": "later",
          "choices": [
            {
              "value": "later",
              "label": "More time"
            },
            {
              "value": "earlier",
              "label": "Earlier home"
            }
          ]
        },
        "variants": [
          {
            "value": "later",
            "label": "More time",
            "thought": "The return journey still belongs inside the day.",
            "consequence": "The end-of-day marker stays later; the person can leave the room immediately.",
            "visual": {
              "kind": "clock-window",
              "clock": "23:30",
              "dayWindow": "longer",
              "emphasis": "return-leg"
            },
            "keyNumbers": [
              {
                "label": "Home by",
                "value": "23:30",
                "unit": "local clock"
              }
            ]
          },
          {
            "value": "earlier",
            "label": "Earlier home",
            "thought": "An earlier return leaves less room for the same activities. What would you keep?",
            "consequence": "Move only the home-by marker earlier. Do not charge time or change the party.",
            "visual": {
              "kind": "clock-window",
              "clock": "22:30",
              "dayWindow": "shorter",
              "emphasis": "return-leg"
            },
            "keyNumbers": [
              {
                "label": "Home by",
                "value": "22:30",
                "unit": "local clock"
              }
            ]
          }
        ],
        "aha": "A deadline applies to the whole day, including getting home.",
        "evidenceStatus": "authored-context",
        "units": [
          "local clock, UTC+8"
        ],
        "unknowns": [
          "No complete Futian itinerary has been timed here.",
          "This clock does not certify transport service or entry."
        ],
        "publicSources": [],
        "scope": "The field-trip world sets a planning constraint only. It does not reuse Lo Wu outing arithmetic as a Futian forecast.",
        "commitBehavior": "in-tab-context-only",
        "modelAdapter": {
          "id": "world-home-by",
          "available": "shell-state",
          "output": "homeByMinutes"
        },
        "fictionalInputs": {
          "later": 1410,
          "earlier": 1350
        },
        "visualInstruction": "Use a large wall clock and a narrow sun-to-moon strip; leave the doorway visible."
      }
    },
    "metro-carriage": {
      "id": "metro-carriage",
      "sceneId": "metro-carriage",
      "title": "Inside the train",
      "placeLabel": "Illustrative rail carriage",
      "pointLabel": "Route above the door",
      "thought": "The train ride is only part of crossing. What happens before boarding and after leaving the station?",
      "primaryThought": "The train ride is only part of crossing. What happens before boarding and after leaving the station?",
      "interactionId": "metro-carriage",
      "action": {
        "interactionId": "metro-carriage",
        "question": "Are you comparing the ride or the whole journey?",
        "input": {
          "kind": "choice",
          "label": "Unfold the route",
          "defaultValue": "ride",
          "choices": [
            {
              "value": "ride",
              "label": "Train ride"
            },
            {
              "value": "whole",
              "label": "Door to door"
            }
          ]
        },
        "variants": [
          {
            "value": "ride",
            "label": "Train ride",
            "thought": "This line shows time aboard. The journey starts earlier and ends later.",
            "consequence": "Highlight only the train segment above the carriage doors.",
            "visual": {
              "kind": "journey-strip",
              "segments": [
                "rail"
              ],
              "unmeasured": [
                "rail"
              ]
            },
            "keyNumbers": []
          },
          {
            "value": "whole",
            "label": "Door to door",
            "thought": "Access, clearance, connections and getting home can change whether the day works.",
            "consequence": "Extend the strip to home, access, clearance, rail, onward walk and the return path.",
            "visual": {
              "kind": "journey-strip",
              "segments": [
                "home",
                "access",
                "clearance",
                "rail",
                "onward",
                "activity",
                "return"
              ],
              "unmeasured": [
                "access",
                "clearance",
                "rail",
                "onward",
                "return"
              ]
            },
            "keyNumbers": []
          }
        ],
        "aha": "Station-to-station time is not a complete outing or commute.",
        "evidenceStatus": "authored-diagram-with-public-context",
        "units": [],
        "unknowns": [
          "Direction-matched journey times, queues and onward services are unknown.",
          "The carriage does not identify one verified end-to-end journey."
        ],
        "publicSources": [
          {
            "id": "mtr-boundary",
            "title": "MTR cross-boundary journeys",
            "url": "https://www.mtr.com.hk/en/customer/services/to_from_lw_lmc.html",
            "checkedOn": "2026-10-07",
            "supports": "Identifies the separate Lo Wu and Lok Ma Chau branches.",
            "limit": "No live fare, complete journey time or personal eligibility is supplied here."
          }
        ],
        "commitBehavior": "free-inspection",
        "visualInstruction": "Keep the carriage interior primary. Animate the train gently; extend the route above its doors, not in a full-screen text card."
      }
    },
    "border-arrival": {
      "id": "border-arrival",
      "sceneId": "border-arrival",
      "title": "Across the boundary",
      "placeLabel": "Futian · illustrative arrival",
      "pointLabel": "Connection board",
      "thought": "The crossing, the train and permission to enter are different checks. Which link have we actually checked?",
      "primaryThought": "The crossing, the train and permission to enter are different checks. Which link have we actually checked?",
      "interactionId": "border-arrival",
      "action": {
        "interactionId": "border-arrival",
        "question": "Does an open crossing make the whole trip usable?",
        "input": {
          "kind": "choice",
          "label": "Expand the checks",
          "defaultValue": "crossing",
          "choices": [
            {
              "value": "crossing",
              "label": "Crossing only"
            },
            {
              "value": "whole-trip",
              "label": "Whole trip"
            }
          ]
        },
        "variants": [
          {
            "value": "crossing",
            "label": "Crossing only",
            "thought": "This is one gate in the journey. It does not confirm the train or anyone’s entry permission.",
            "consequence": "Show the control-point gate alone with a check-needed symbol.",
            "visual": {
              "kind": "gate-chain",
              "gates": [
                "control-point"
              ],
              "statuses": [
                "not-checked"
              ]
            },
            "keyNumbers": []
          },
          {
            "value": "whole-trip",
            "label": "Whole trip",
            "thought": "A usable trip needs its connections and entry conditions too. Unknown stays unknown.",
            "consequence": "Unfold separate control-point, train, onward-connection and entry tiles.",
            "visual": {
              "kind": "gate-chain",
              "gates": [
                "control-point",
                "train",
                "onward-connection",
                "entry"
              ],
              "statuses": [
                "not-checked",
                "not-checked",
                "not-checked",
                "not-checked"
              ]
            },
            "keyNumbers": []
          }
        ],
        "aha": "Opening hours, transport availability and eligibility are separate constraints.",
        "evidenceStatus": "authored-diagram-with-public-context",
        "units": [],
        "unknowns": [
          "Current last services and onward connections have not been checked for this trip.",
          "Admission and travel-document conditions remain unverified."
        ],
        "publicSources": [
          {
            "id": "control-points",
            "title": "Hong Kong Immigration Department control points",
            "url": "https://www.immd.gov.hk/eng/contactus/control_points.html",
            "checkedOn": "2026-10-07",
            "supports": "Control points have distinct operating arrangements.",
            "limit": "An open control point does not establish the last train, every connection or admission eligibility."
          },
          {
            "id": "mtr-boundary",
            "title": "MTR cross-boundary journeys",
            "url": "https://www.mtr.com.hk/en/customer/services/to_from_lw_lmc.html",
            "checkedOn": "2026-10-07",
            "supports": "Identifies the separate Lo Wu and Lok Ma Chau branches.",
            "limit": "No live fare, complete journey time or personal eligibility is supplied here."
          }
        ],
        "commitBehavior": "free-inspection",
        "routeIdentity": {
          "name": "Lok Ma Chau / Futian",
          "differentFrom": "Lo Wu / Luohu"
        },
        "visualInstruction": "Reveal linked gates across the signboard. Use question marks, never a false green clearance light."
      }
    },
    "parcel-counter": {
      "id": "parcel-counter",
      "sceneId": "parcel-counter",
      "title": "Get the parcel home",
      "placeLabel": "Fictional collection counter",
      "pointLabel": "Parcel and receipt",
      "thought": "Collecting a parcel may fit a trip you already planned. What changes if the parcel is the reason for crossing?",
      "primaryThought": "Collecting a parcel may fit a trip you already planned. What changes if the parcel is the reason for crossing?",
      "interactionId": "parcel-counter",
      "action": {
        "interactionId": "parcel-counter",
        "question": "Were you already going?",
        "input": {
          "kind": "choice",
          "label": "Move the parcel route",
          "defaultValue": "already-going",
          "choices": [
            {
              "value": "already-going",
              "label": "Already going"
            },
            {
              "value": "dedicated-trip",
              "label": "Go just for it"
            }
          ]
        },
        "variants": [
          {
            "value": "already-going",
            "label": "Already going",
            "thought": "The extra detour is small in this example. The original outing is outside this parcel calculation.",
            "consequence": "Keep the existing trip faint; animate only the additional pickup loop.",
            "visual": {
              "kind": "parcel-path",
              "showDedicatedLeg": false,
              "receiptBreakdown": [
                "handling",
                "detour"
              ]
            },
            "keyNumbers": [
              {
                "label": "Extra logistics",
                "value": 16,
                "unit": "CNY-equivalent"
              },
              {
                "label": "Extra time",
                "value": 20,
                "unit": "minutes"
              }
            ]
          },
          {
            "value": "dedicated-trip",
            "label": "Go just for it",
            "thought": "Now the collection bears a whole extra trip. Its handling fee did not change.",
            "consequence": "Add the full dedicated outward-and-return loop before the same counter stop.",
            "visual": {
              "kind": "parcel-path",
              "showDedicatedLeg": true,
              "receiptBreakdown": [
                "handling",
                "detour",
                "dedicated-trip"
              ]
            },
            "keyNumbers": [
              {
                "label": "Extra logistics",
                "value": 116,
                "unit": "CNY-equivalent"
              },
              {
                "label": "Extra time",
                "value": 160,
                "unit": "minutes"
              }
            ]
          }
        ],
        "aha": "The same service can be inexpensive as an add-on and costly as a dedicated trip.",
        "evidenceStatus": "authored-arithmetic",
        "units": [
          "CNY-equivalent, a fictional common unit",
          "minutes"
        ],
        "unknowns": [
          "Delivery duration, real fares, current fees, item eligibility and return terms are unknown.",
          "Receipts are not the counter’s profit."
        ],
        "publicSources": [
          {
            "id": "parcel-handoffs",
            "title": "Consumer Council cross-border shopping alert",
            "url": "https://www.consumer.org.hk/tc/press-release/consumeralert_onlineshopping",
            "publishedOn": "2025-07-22",
            "checkedOn": "2026-10-07",
            "supports": "Purchases can involve sellers, carriers, storage and collection; responsibility can be disputed between handoffs.",
            "limit": "It supplies none of the fictional prices and no particular shop contract."
          },
          {
            "id": "parcel-delivery",
            "title": "SF Express consolidation service",
            "url": "https://www.sf-express.com/chn/en/express/delivery/hkmotw-buy",
            "checkedOn": "2026-10-07",
            "supports": "One operator offers consolidation and delivery or collection choices.",
            "limit": "Carrying a parcel yourself is different; availability and all-in quotes require checking."
          }
        ],
        "commitBehavior": "free-inspection",
        "modelAdapter": {
          "id": "compareParcelPickup",
          "available": "existing-pure-module",
          "input": "situation",
          "output": "pickupCost and extraMinutes"
        },
        "fictionalInputs": {
          "counterHandling": 6,
          "localDetourTransport": 10,
          "localDetourMinutes": 20,
          "dedicatedTripTransport": 100,
          "dedicatedTripMinutes": 140,
          "homeDeliveryQuote": 35
        },
        "scope": "Additional parcel logistics only. Never convert to or add to the separate HKD outing total.",
        "visualInstruction": "The parcel moves along the route. Keep the receipt to two figures; delivery comparison and handoff details expand separately."
      }
    },
    "mall-foodcourt": {
      "id": "mall-foodcourt",
      "sceneId": "mall-foodcourt",
      "title": "A familiar frontage",
      "placeLabel": "Fictional food court",
      "pointLabel": "Menu and shopfront",
      "thought": "A familiar menu can attract neighbours, workers and visitors. How might the business respond if its customers changed?",
      "primaryThought": "A familiar menu can attract neighbours, workers and visitors. How might the business respond if its customers changed?",
      "interactionId": "mall-foodcourt",
      "action": {
        "interactionId": "mall-foodcourt",
        "question": "Who are you imagining comes through this door?",
        "input": {
          "kind": "choice",
          "label": "Change the imagined demand",
          "defaultValue": "cross-border",
          "choices": [
            {
              "value": "cross-border",
              "label": "Visitor-led"
            },
            {
              "value": "local-routine",
              "label": "Routine-led"
            }
          ]
        },
        "variants": [
          {
            "value": "cross-border",
            "label": "Visitor-led",
            "thought": "In this hypothesis, the shop makes a whole visit easier. We have not measured who its customers are.",
            "consequence": "Reveal visitor route, shared-table and take-home-service cues around the frontage.",
            "visual": {
              "kind": "catchment-response",
              "emphasizedAudience": "cross-border-visitors",
              "responseObjects": [
                "shared-table",
                "visitor-wayfinding",
                "take-home-counter"
              ],
              "claim": "hypothesis"
            },
            "keyNumbers": []
          },
          {
            "value": "local-routine",
            "label": "Routine-led",
            "thought": "In this hypothesis, nearby routines matter more. The same food could serve a different pattern of visits.",
            "consequence": "Replace the response cues with quick-lunch, repeat-visit and nearby-delivery cues.",
            "visual": {
              "kind": "catchment-response",
              "emphasizedAudience": "nearby-workers-and-residents",
              "responseObjects": [
                "quick-lunch-counter",
                "repeat-visit-board",
                "local-delivery-bag"
              ],
              "claim": "hypothesis"
            },
            "keyNumbers": []
          }
        ],
        "aha": "Businesses can adapt their format to a customer mix; cuisine and a quiet moment do not reveal that mix.",
        "evidenceStatus": "authored-counterfactual-with-public-context",
        "units": [],
        "unknowns": [
          "Customer origins, spending shares, demand trends, margins and actual adaptation are unmeasured.",
          "These response cues are possibilities, not claims about a named restaurant."
        ],
        "publicSources": [
          {
            "id": "mall-catchments",
            "title": "Link CentralWalk operator description",
            "url": "https://www.linkreit.com/en/business/properties/link-centralwalk/",
            "checkedOn": "2026-10-07",
            "supports": "One mall describes nearby office workers, younger consumers and families among its audiences.",
            "limit": "Operator positioning is not a visitor survey; this fictional food court is not that property."
          },
          {
            "id": "mall-adaptation",
            "title": "Link REIT interim report 2024/25",
            "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2024/1127/2024112700412.pdf",
            "publishedOn": "2024-11-27",
            "checkedOn": "2026-10-07",
            "supports": "A historical corporate report describes cross-border positioning and changes to space and services.",
            "limit": "It does not establish the cause of any particular venue’s current demand."
          }
        ],
        "commitBehavior": "free-inspection",
        "scope": "One hypothetical demand change. No numerical shares, wage inference or automatic business success.",
        "visualInstruction": "Make storefront objects actually change. Keep both local and visitor silhouettes possible; do not assign nationality from appearance."
      }
    },
    "neighborhood-lane": {
      "id": "neighborhood-lane",
      "sceneId": "neighborhood-lane",
      "title": "Between destinations",
      "placeLabel": "Fictional residential neighbourhood",
      "pointLabel": "Neighbourhood noticeboard",
      "thought": "Shops and a park look different when they become part of your week. What would you make time to return for?",
      "primaryThought": "Shops and a park look different when they become part of your week. What would you make time to return for?",
      "interactionId": "neighborhood-lane",
      "action": {
        "interactionId": "neighborhood-lane",
        "question": "Is this a passing visit or a recurring stop?",
        "input": {
          "kind": "choice",
          "label": "Place the visit in the week",
          "defaultValue": "passing",
          "choices": [
            {
              "value": "passing",
              "label": "Passing through"
            },
            {
              "value": "returning",
              "label": "Return regularly"
            }
          ]
        },
        "variants": [
          {
            "value": "passing",
            "label": "Passing through",
            "thought": "Today gives a glimpse. It does not tell us what living here feels like.",
            "consequence": "Trace a single path past the park, shop and home entrance.",
            "visual": {
              "kind": "routine-map",
              "repeat": false,
              "highlightedPlaces": [
                "park",
                "shop",
                "home-entrance"
              ]
            },
            "keyNumbers": []
          },
          {
            "value": "returning",
            "label": "Return regularly",
            "thought": "A recurring stop takes time that could go elsewhere. Relationships and belonging still cannot be assumed.",
            "consequence": "Move the park marker onto a recurring calendar slot and highlight the competing open time.",
            "visual": {
              "kind": "routine-map",
              "repeat": true,
              "highlightedPlaces": [
                "park"
              ],
              "displacedSlot": "unallocated-time"
            },
            "keyNumbers": []
          }
        ],
        "aha": "Repeated presence uses time; community participation and belonging need their own evidence.",
        "evidenceStatus": "authored-counterfactual",
        "units": [],
        "unknowns": [
          "Residents’ income, tenure, personal ties and feelings are unknown.",
          "No real participation schedule or service access is promised."
        ],
        "publicSources": [
          {
            "id": "neighborhood-plan",
            "title": "Lianhua area statutory plan",
            "url": "https://pnr.sz.gov.cn/ywzy/fdtz/cggbcx/ftq/content/post_5835767.html",
            "publishedOn": "2009-02-27",
            "checkedOn": "2026-10-07",
            "supports": "An official historical planning source for a residential area.",
            "limit": "It does not establish today’s household income, belonging or urban-village status."
          }
        ],
        "commitBehavior": "in-tab-context-only",
        "scope": "This scene is not a classification of Lianhua Er Cun or a portrait of its residents.",
        "visualInstruction": "Keep public space and small people visible. Place one marker; do not create friendship points or invented neighbours’ dialogue."
      }
    },
    "urban-village": {
      "id": "urban-village",
      "sceneId": "urban-village",
      "title": "A lane of everyday uses",
      "placeLabel": "Fictional urban-village lane",
      "pointLabel": "Passage between buildings",
      "thought": "A useful home is connected to everyday places. What changes when the nearby passage is unavailable?",
      "primaryThought": "A useful home is connected to everyday places. What changes when the nearby passage is unavailable?",
      "interactionId": "urban-village",
      "action": {
        "interactionId": "urban-village",
        "question": "How much does this shortcut matter?",
        "input": {
          "kind": "choice",
          "label": "Open or close the passage",
          "defaultValue": "open",
          "choices": [
            {
              "value": "open",
              "label": "Passage open"
            },
            {
              "value": "closed",
              "label": "Passage closed"
            }
          ]
        },
        "variants": [
          {
            "value": "open",
            "label": "Passage open",
            "thought": "The short path works in this made-up layout. Its convenience is separate from the rent.",
            "consequence": "Open the alley and animate the short home-to-shop path.",
            "visual": {
              "kind": "access-detour",
              "passageOpen": true,
              "pathEdges": [
                2,
                4
              ]
            },
            "keyNumbers": [
              {
                "label": "Example walk",
                "value": 6,
                "unit": "minutes"
              }
            ]
          },
          {
            "value": "closed",
            "label": "Passage closed",
            "thought": "The same home now needs a longer walk. We have not changed its rent, residents or legal status.",
            "consequence": "Close only the passage, then trace the visible alternative around the block.",
            "visual": {
              "kind": "access-detour",
              "passageOpen": false,
              "pathEdges": [
                5,
                5,
                4
              ]
            },
            "keyNumbers": [
              {
                "label": "Example walk",
                "value": 14,
                "unit": "minutes"
              }
            ]
          }
        ],
        "aha": "Proximity on a map and a usable connection are different parts of housing access.",
        "evidenceStatus": "authored-arithmetic",
        "units": [
          "minutes in an invented walking network"
        ],
        "unknowns": [
          "No real urban-village boundary, rent, tenure, redevelopment or resident characteristic is asserted."
        ],
        "publicSources": [
          {
            "id": "urban-village-policy",
            "title": "Shenzhen urban-village policy framework",
            "url": "https://www.sz.gov.cn/zfgb/2024/gb1330/content/post_11276279.html",
            "publishedOn": "2024-05-07",
            "checkedOn": "2026-10-07",
            "supports": "Urban-village policy uses particular land and institutional relationships.",
            "limit": "Visual density, a place name or cheap-looking rooms cannot establish a real place’s classification."
          }
        ],
        "commitBehavior": "free-inspection",
        "fictionalInputs": {
          "openEdgesMinutes": [
            2,
            4
          ],
          "closedEdgesMinutes": [
            5,
            5,
            4
          ]
        },
        "scope": "An original fictional place, not a renamed observed estate. Passage closure is a what-if, not an allegation of displacement.",
        "visualInstruction": "Visibly change the actual passage and highlighted route. Keep residents ordinary; no poverty spectacle or intrusive interiors."
      }
    },
    "rental-home": {
      "id": "rental-home",
      "sceneId": "rental-home",
      "title": "Keys and a lease",
      "placeLabel": "Fictional rental home",
      "pointLabel": "Lease on the table",
      "thought": "Some move-in money is spent; some may be held and returned. Which part is which in this example?",
      "primaryThought": "Some move-in money is spent; some may be held and returned. Which part is which in this example?",
      "interactionId": "rental-home",
      "action": {
        "interactionId": "rental-home",
        "question": "What happened to the move-in cash?",
        "input": {
          "kind": "choice",
          "label": "Sort the payment",
          "defaultValue": "cash-out",
          "choices": [
            {
              "value": "cash-out",
              "label": "Cash leaving"
            },
            {
              "value": "claims",
              "label": "What remains"
            }
          ]
        },
        "variants": [
          {
            "value": "cash-out",
            "label": "Cash leaving",
            "thought": "Both payments reduce cash available today. That does not make both consumed costs.",
            "consequence": "Move two labelled stacks from the wallet to the lease tray.",
            "visual": {
              "kind": "rental-cash",
              "lens": "cash-out",
              "stacks": [
                "first-month-rent",
                "refundable-deposit"
              ]
            },
            "keyNumbers": [
              {
                "label": "Rent paid",
                "value": 6000,
                "unit": "HKD"
              },
              {
                "label": "Deposit held",
                "value": 12000,
                "unit": "HKD"
              }
            ]
          },
          {
            "value": "claims",
            "label": "What remains",
            "thought": "This fictional lease makes the deposit refundable under its terms. Rent pays for use; the deposit remains a claim.",
            "consequence": "Keep rent in the use tray; move the deposit stack to a return-claim envelope.",
            "visual": {
              "kind": "rental-cash",
              "lens": "claims",
              "stacks": [
                "use-paid",
                "return-claim"
              ]
            },
            "keyNumbers": [
              {
                "label": "Use paid",
                "value": 6000,
                "unit": "HKD"
              },
              {
                "label": "Return claim",
                "value": 12000,
                "unit": "HKD"
              }
            ]
          }
        ],
        "aha": "Cash needed now and non-refundable housing cost answer different questions.",
        "evidenceStatus": "authored-arithmetic",
        "units": [
          "HKD in a fictional lease"
        ],
        "unknowns": [
          "Real rent, included charges, refund deductions, lease-break rights and eligibility require exact terms.",
          "No market quote or recommended deposit size is implied."
        ],
        "publicSources": [
          {
            "id": "housing-guide",
            "title": "Consumer Council Greater Bay Area housing guide",
            "url": "https://www.consumer.org.hk/tc/press-release/p-gba-smart-guide-residential-properties",
            "publishedOn": "2025-02-05",
            "checkedOn": "2026-10-07",
            "supports": "Rental and purchase processes, terminology and legal checks vary by location.",
            "limit": "This is not a listing, matched-property comparison, eligibility decision or current fee quote."
          },
          {
            "id": "household-cash",
            "title": "IFEC managing money, credit and debt",
            "url": "https://www.ifec.org.hk/web/common/pdf/publication/en/IEC-managing-your-money-credit-and-debt-booklet.pdf",
            "checkedOn": "2026-10-07",
            "supports": "Housing can require deposits, fees, recurring costs and cash committed to assets.",
            "limit": "Lease terms and current charges must be checked; the game’s figures are authored."
          }
        ],
        "commitBehavior": "free-inspection",
        "fictionalInputs": {
          "firstMonthRentHKD": 6000,
          "depositHKD": 12000,
          "depositTerms": "Refundable under the fictional lease, subject to its stated terms; not a universal rule."
        },
        "scope": "One payment classification. No forecast saving or real tenancy is created.",
        "visualInstruction": "Two physical stacks and two destinations. The lease text is optional; no budget form or spreadsheet."
      }
    },
    "luxury-home": {
      "id": "luxury-home",
      "sceneId": "luxury-home",
      "title": "Behind the showroom",
      "placeLabel": "Fictional property showroom",
      "pointLabel": "Home model and payment",
      "thought": "A polished home is also a financial commitment. What part of a payment buys use, and what part reduces debt?",
      "primaryThought": "A polished home is also a financial commitment. What part of a payment buys use, and what part reduces debt?",
      "interactionId": "luxury-home",
      "action": {
        "interactionId": "luxury-home",
        "question": "Where did this example payment go?",
        "input": {
          "kind": "choice",
          "label": "Turn the payment model",
          "defaultValue": "payment",
          "choices": [
            {
              "value": "payment",
              "label": "Split the payment"
            },
            {
              "value": "asset",
              "label": "Look at the asset"
            }
          ]
        },
        "variants": [
          {
            "value": "payment",
            "label": "Split the payment",
            "thought": "Interest is paid to borrow. Principal reduces the loan; it is not cash you can freely spend.",
            "consequence": "Split the payment stream into an interest tray and a reduced-debt block.",
            "visual": {
              "kind": "ownership-payment",
              "lens": "payment",
              "showFutureValue": false
            },
            "keyNumbers": [
              {
                "label": "Interest paid",
                "value": 8000,
                "unit": "HKD"
              },
              {
                "label": "Debt reduced",
                "value": 4000,
                "unit": "HKD"
              }
            ]
          },
          {
            "value": "asset",
            "label": "Look at the asset",
            "thought": "Less debt does not tell us the future selling price. Equity and sale proceeds still depend on unknowns.",
            "consequence": "Lower the loan block; leave the future property-value block translucent and unnumbered.",
            "visual": {
              "kind": "ownership-payment",
              "lens": "asset",
              "showFutureValue": true
            },
            "keyNumbers": [
              {
                "label": "Debt reduced",
                "value": 4000,
                "unit": "HKD"
              }
            ]
          }
        ],
        "aha": "Principal, interest, cash available and uncertain equity are different quantities.",
        "evidenceStatus": "authored-arithmetic",
        "units": [
          "HKD, one fictional payment period"
        ],
        "unknowns": [
          "Future property value, resale timing, exit costs, financing eligibility and local taxes are unknown.",
          "This is neither a complete amortization model nor an investment recommendation."
        ],
        "publicSources": [
          {
            "id": "borrowing",
            "title": "IFEC responsible borrowing",
            "url": "https://www.ifec.org.hk/web/en/moneyessentials/debts-and-borrowing/before-you-borrow.page",
            "checkedOn": "2026-10-07",
            "supports": "Repayments contain principal and interest, and borrowing can incur additional charges.",
            "limit": "No current rate, mortgage approval, tax rule or future resale value is supplied."
          },
          {
            "id": "household-cash",
            "title": "IFEC managing money, credit and debt",
            "url": "https://www.ifec.org.hk/web/common/pdf/publication/en/IEC-managing-your-money-credit-and-debt-booklet.pdf",
            "checkedOn": "2026-10-07",
            "supports": "Housing can require deposits, fees, recurring costs and cash committed to assets.",
            "limit": "Lease terms and current charges must be checked; the game’s figures are authored."
          }
        ],
        "commitBehavior": "free-inspection",
        "fictionalInputs": {
          "initialLoanHKD": 2400000,
          "annualNominalRate": 0.04,
          "firstPaymentHKD": 12000,
          "firstMonthInterestHKD": 8000,
          "firstMonthPrincipalHKD": 4000
        },
        "scope": "One-period accounting example only. Do not extrapolate without a consistent loan term/payment schedule. This showroom is not a claim about a real tower’s residential use.",
        "visualInstruction": "Show physical money streams and house/debt blocks. Render at most two numerical quantities; future price stays visibly unknown."
      }
    },
    "office-floor": {
      "id": "office-floor",
      "sceneId": "office-floor",
      "title": "A quiet floor",
      "placeLabel": "Fictional commercial building",
      "pointLabel": "Lift directory",
      "thought": "An empty-looking room tells us what was visible then. Does it tell us whether the space was leased?",
      "primaryThought": "An empty-looking room tells us what was visible then. Does it tell us whether the space was leased?",
      "interactionId": "office-floor",
      "action": {
        "interactionId": "office-floor",
        "question": "What do you actually know about this floor?",
        "input": {
          "kind": "choice",
          "label": "Change the evidence lens",
          "defaultValue": "visible",
          "choices": [
            {
              "value": "visible",
              "label": "What is visible"
            },
            {
              "value": "leases",
              "label": "What is leased"
            }
          ]
        },
        "variants": [
          {
            "value": "visible",
            "label": "What is visible",
            "thought": "The public area looks quiet in this authored scene. The other rooms have not been inspected.",
            "consequence": "Light only the corridor and visible room; mask the rest of the floor plan.",
            "visual": {
              "kind": "floor-coverage",
              "lens": "visible-activity",
              "observed": [
                "public-corridor",
                "visible-room"
              ],
              "unknown": [
                "other-rooms",
                "other-floors",
                "leases"
              ]
            },
            "keyNumbers": []
          },
          {
            "value": "leases",
            "label": "What is leased",
            "thought": "The view cannot fill a lease register. Sold, leased, open and busy describe different things.",
            "consequence": "Replace visible-person marks with a lease-register overlay whose entries remain unknown.",
            "visual": {
              "kind": "floor-coverage",
              "lens": "lease-status",
              "observed": [],
              "unknown": [
                "all-lease-statuses"
              ],
              "keepPhysicalScene": true
            },
            "keyNumbers": []
          }
        ],
        "aha": "Visible activity, occupancy and developer inventory are different measures.",
        "evidenceStatus": "authored-diagram-with-public-context",
        "units": [],
        "unknowns": [
          "Building identity, actual use, leases, public access and representative vacancy data are unknown.",
          "One holiday visit cannot establish a demand trend."
        ],
        "publicSources": [
          {
            "id": "property-definitions",
            "title": "National Bureau of Statistics property definitions",
            "url": "https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903764.html",
            "publishedOn": "2025-01-26",
            "checkedOn": "2026-10-07",
            "supports": "Sales, unsold developer property and visible activity are different measures.",
            "limit": "Developer inventory cannot establish vacancy, attendance or the use of this fictional building."
          }
        ],
        "commitBehavior": "free-inspection",
        "scope": "A fictional commercial building, not a claim about a named office block. A separate optional workweek can use the existing same-job/two-home-base model.",
        "optionalModelAdapter": {
          "id": "compareCommutes",
          "available": "existing-separate-module",
          "scope": "One fictional adult, same Admiralty-area job and separately authored home bases. Do not inherit this building, party or route."
        },
        "visualInstruction": "The floor plan changes from visible coverage to a separate unknown lease layer. Do not fabricate vacant-unit percentages or darken a whole city."
      }
    },
    "learning-center": {
      "id": "learning-center",
      "sceneId": "learning-center",
      "title": "A class after work",
      "placeLabel": "Fictional adult learning centre",
      "pointLabel": "Class on the calendar",
      "thought": "An opportunity can be nearby and still hard to use. Does this class fit around the rest of the day?",
      "primaryThought": "An opportunity can be nearby and still hard to use. Does this class fit around the rest of the day?",
      "interactionId": "learning-center",
      "action": {
        "interactionId": "learning-center",
        "question": "Which session can you actually reach?",
        "input": {
          "kind": "choice",
          "label": "Move the same class later",
          "defaultValue": "earlier",
          "choices": [
            {
              "value": "earlier",
              "label": "Earlier session"
            },
            {
              "value": "later",
              "label": "Later session"
            }
          ]
        },
        "variants": [
          {
            "value": "earlier",
            "label": "Earlier session",
            "thought": "This fictional journey reaches the earlier class after it starts. The course itself did not change.",
            "consequence": "Slide the arrival marker past the first part of the class block.",
            "visual": {
              "kind": "schedule-overlap",
              "finishWork": 1080,
              "travelMinutes": 45,
              "classStart": 1110,
              "arrival": 1125
            },
            "keyNumbers": [
              {
                "label": "Arrival",
                "value": "18:45",
                "unit": "local clock"
              },
              {
                "label": "Late by",
                "value": 15,
                "unit": "minutes"
              }
            ]
          },
          {
            "value": "later",
            "label": "Later session",
            "thought": "The later session leaves a margin in this example. Fees, teaching quality and future jobs remain separate questions.",
            "consequence": "Move only the class block later and show the gap before it starts.",
            "visual": {
              "kind": "schedule-overlap",
              "finishWork": 1080,
              "travelMinutes": 45,
              "classStart": 1170,
              "arrival": 1125
            },
            "keyNumbers": [
              {
                "label": "Arrival",
                "value": "18:45",
                "unit": "local clock"
              },
              {
                "label": "Time before class",
                "value": 45,
                "unit": "minutes"
              }
            ]
          }
        ],
        "aha": "Access to an opportunity includes schedule fit, not just price or credentials.",
        "evidenceStatus": "authored-arithmetic",
        "units": [
          "local clock, UTC+8",
          "minutes"
        ],
        "unknowns": [
          "No actual course, fee, admission, teaching quality or employment return is established.",
          "The adult learner is fictional; no real tutor credential or biography is used."
        ],
        "publicSources": [],
        "commitBehavior": "free-inspection",
        "fictionalInputs": {
          "workFinishMinute": 1080,
          "journeyMinutes": 45,
          "earlyClassMinute": 1110,
          "laterClassMinute": 1170
        },
        "scope": "Two invented offers of the same adult class. Not a promise that an actual provider will reschedule.",
        "visualInstruction": "Drag or tap to move the single class block; let the character reach its door. Keep the before/after overlap visible, with no forms."
      }
    },
    "planning-museum": {
      "id": "planning-museum",
      "sceneId": "planning-museum",
      "title": "Whose centre is this?",
      "placeLabel": "Illustrative planning exhibition",
      "pointLabel": "Layered city model",
      "thought": "A plan shows possibilities. What changes when a proposed connection is drawn as though it already exists?",
      "primaryThought": "A plan shows possibilities. What changes when a proposed connection is drawn as though it already exists?",
      "interactionId": "planning-museum",
      "action": {
        "interactionId": "planning-museum",
        "question": "Are you looking at today or a possible future?",
        "input": {
          "kind": "choice",
          "label": "Switch the city layer",
          "defaultValue": "current",
          "choices": [
            {
              "value": "current",
              "label": "Today’s layer"
            },
            {
              "value": "planned",
              "label": "Possible future"
            }
          ]
        },
        "variants": [
          {
            "value": "current",
            "label": "Today’s layer",
            "thought": "Only the current layer belongs in a present-day journey. The model’s exact travel times are unmeasured.",
            "consequence": "Show solid schematic connections and keep proposed lines faint and disconnected.",
            "visual": {
              "kind": "city-layers",
              "active": "current",
              "solid": "illustrative-current",
              "dashed": "proposed",
              "routeTimes": "unknown"
            },
            "keyNumbers": []
          },
          {
            "value": "planned",
            "label": "Possible future",
            "thought": "A new connection could change reachable places. This plan does not show that service or its benefits have arrived.",
            "consequence": "Reveal a clearly dashed proposed link; pulse the newly connected nodes without adding a journey-time claim.",
            "visual": {
              "kind": "city-layers",
              "active": "proposed",
              "solid": "illustrative-current",
              "dashed": "proposed",
              "routeTimes": "unknown"
            },
            "keyNumbers": []
          }
        ],
        "aha": "Planned structure, operating services and experienced access need different evidence.",
        "evidenceStatus": "schematic-counterfactual-with-public-context",
        "units": [],
        "unknowns": [
          "Exact map geometry, current complete services and future journey times are not supplied.",
          "Historical internal boundaries are different from today’s Hong Kong boundary."
        ],
        "publicSources": [
          {
            "id": "city-plan",
            "title": "Shenzhen Territorial Spatial Master Plan 2021–2035",
            "url": "https://www.sz.gov.cn/cn/xxgk/zfxxgj/ghjh/csgh/zt/content/post_12013111.html",
            "publishedOn": "2025-02-20",
            "checkedOn": "2026-10-07",
            "supports": "The adopted plan describes multiple centres and different planning scales.",
            "limit": "A plan is not proof that a link operates or that projected benefits occurred; this map is schematic."
          },
          {
            "id": "boundary-history",
            "title": "State Council management-line removal decision",
            "url": "https://app.www.gov.cn/govdata/gov/201801/15/419496/article.html",
            "publishedOn": "2018-01-15",
            "checkedOn": "2026-10-07",
            "supports": "Removal of the former internal SEZ management line is distinct from the Hong Kong boundary.",
            "limit": "It does not establish present access, rents or an exact line on this schematic map."
          }
        ],
        "commitBehavior": "free-inspection",
        "scope": "A schematic exhibition, not a geographic route planner. Planned links never become current facts by changing this lens.",
        "visualInstruction": "Make the tabletop city physically gain a dashed link. Keep the exhibition and player in view; avoid a full-screen data dashboard."
      }
    }
  },
  "sources": {
    "mtr-boundary": {
      "title": "MTR cross-boundary journeys",
      "url": "https://www.mtr.com.hk/en/customer/services/to_from_lw_lmc.html",
      "checkedOn": "2026-10-07",
      "supports": "Identifies the separate Lo Wu and Lok Ma Chau branches.",
      "limit": "No live fare, complete journey time or personal eligibility is supplied here."
    },
    "control-points": {
      "title": "Hong Kong Immigration Department control points",
      "url": "https://www.immd.gov.hk/eng/contactus/control_points.html",
      "checkedOn": "2026-10-07",
      "supports": "Control points have distinct operating arrangements.",
      "limit": "An open control point does not establish the last train, every connection or admission eligibility."
    },
    "parcel-handoffs": {
      "title": "Consumer Council cross-border shopping alert",
      "url": "https://www.consumer.org.hk/tc/press-release/consumeralert_onlineshopping",
      "publishedOn": "2025-07-22",
      "checkedOn": "2026-10-07",
      "supports": "Purchases can involve sellers, carriers, storage and collection; responsibility can be disputed between handoffs.",
      "limit": "It supplies none of the fictional prices and no particular shop contract."
    },
    "parcel-delivery": {
      "title": "SF Express consolidation service",
      "url": "https://www.sf-express.com/chn/en/express/delivery/hkmotw-buy",
      "checkedOn": "2026-10-07",
      "supports": "One operator offers consolidation and delivery or collection choices.",
      "limit": "Carrying a parcel yourself is different; availability and all-in quotes require checking."
    },
    "mall-catchments": {
      "title": "Link CentralWalk operator description",
      "url": "https://www.linkreit.com/en/business/properties/link-centralwalk/",
      "checkedOn": "2026-10-07",
      "supports": "One mall describes nearby office workers, younger consumers and families among its audiences.",
      "limit": "Operator positioning is not a visitor survey; this fictional food court is not that property."
    },
    "mall-adaptation": {
      "title": "Link REIT interim report 2024/25",
      "url": "https://www1.hkexnews.hk/listedco/listconews/sehk/2024/1127/2024112700412.pdf",
      "publishedOn": "2024-11-27",
      "checkedOn": "2026-10-07",
      "supports": "A historical corporate report describes cross-border positioning and changes to space and services.",
      "limit": "It does not establish the cause of any particular venue’s current demand."
    },
    "neighborhood-plan": {
      "title": "Lianhua area statutory plan",
      "url": "https://pnr.sz.gov.cn/ywzy/fdtz/cggbcx/ftq/content/post_5835767.html",
      "publishedOn": "2009-02-27",
      "checkedOn": "2026-10-07",
      "supports": "An official historical planning source for a residential area.",
      "limit": "It does not establish today’s household income, belonging or urban-village status."
    },
    "urban-village-policy": {
      "title": "Shenzhen urban-village policy framework",
      "url": "https://www.sz.gov.cn/zfgb/2024/gb1330/content/post_11276279.html",
      "publishedOn": "2024-05-07",
      "checkedOn": "2026-10-07",
      "supports": "Urban-village policy uses particular land and institutional relationships.",
      "limit": "Visual density, a place name or cheap-looking rooms cannot establish a real place’s classification."
    },
    "housing-guide": {
      "title": "Consumer Council Greater Bay Area housing guide",
      "url": "https://www.consumer.org.hk/tc/press-release/p-gba-smart-guide-residential-properties",
      "publishedOn": "2025-02-05",
      "checkedOn": "2026-10-07",
      "supports": "Rental and purchase processes, terminology and legal checks vary by location.",
      "limit": "This is not a listing, matched-property comparison, eligibility decision or current fee quote."
    },
    "household-cash": {
      "title": "IFEC managing money, credit and debt",
      "url": "https://www.ifec.org.hk/web/common/pdf/publication/en/IEC-managing-your-money-credit-and-debt-booklet.pdf",
      "checkedOn": "2026-10-07",
      "supports": "Housing can require deposits, fees, recurring costs and cash committed to assets.",
      "limit": "Lease terms and current charges must be checked; the game’s figures are authored."
    },
    "borrowing": {
      "title": "IFEC responsible borrowing",
      "url": "https://www.ifec.org.hk/web/en/moneyessentials/debts-and-borrowing/before-you-borrow.page",
      "checkedOn": "2026-10-07",
      "supports": "Repayments contain principal and interest, and borrowing can incur additional charges.",
      "limit": "No current rate, mortgage approval, tax rule or future resale value is supplied."
    },
    "property-definitions": {
      "title": "National Bureau of Statistics property definitions",
      "url": "https://www.stats.gov.cn/zs/tjws/tjzb/202301/t20230101_1903764.html",
      "publishedOn": "2025-01-26",
      "checkedOn": "2026-10-07",
      "supports": "Sales, unsold developer property and visible activity are different measures.",
      "limit": "Developer inventory cannot establish vacancy, attendance or the use of this fictional building."
    },
    "city-plan": {
      "title": "Shenzhen Territorial Spatial Master Plan 2021–2035",
      "url": "https://www.sz.gov.cn/cn/xxgk/zfxxgj/ghjh/csgh/zt/content/post_12013111.html",
      "publishedOn": "2025-02-20",
      "checkedOn": "2026-10-07",
      "supports": "The adopted plan describes multiple centres and different planning scales.",
      "limit": "A plan is not proof that a link operates or that projected benefits occurred; this map is schematic."
    },
    "boundary-history": {
      "title": "State Council management-line removal decision",
      "url": "https://app.www.gov.cn/govdata/gov/201801/15/419496/article.html",
      "publishedOn": "2018-01-15",
      "checkedOn": "2026-10-07",
      "supports": "Removal of the former internal SEZ management line is distinct from the Hong Kong boundary.",
      "limit": "It does not establish present access, rents or an exact line on this schematic map."
    }
  }
} as const;
export const WORLD_SCENES = WORLD_CONTENT.scenes;
export type WorldSceneId = keyof typeof WORLD_SCENES;
export type WorldSceneContent = (typeof WORLD_SCENES)[WorldSceneId];
export default WORLD_CONTENT;
