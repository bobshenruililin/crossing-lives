import type { SceneId, SceneRecord } from './types';
/** Root-reviewed original assets. Museum wall is decorative; regional geometry belongs in its inspected overlay. */
export const SCENE_ART_OVERRIDES: Partial<Record<SceneId, Partial<SceneRecord>>> = {
  "hk-home": {
    "title": "A day begins",
    "placeLabel": "Hong Kong · fictional home",
    "art": {
      "src": "art/hk-home.webp",
      "alt": "Pixel-art home entrance with a desk, plain clock, two day bags, rain jacket, umbrella and an open front door to a blue-gray communal corridor.",
      "approved": true
    },
    "playerStart": {
      "x": 1120,
      "y": 837.49
    },
    "entryPoints": {
      "left": {
        "x": 1120,
        "y": 837.49
      },
      "right": {
        "x": 1120,
        "y": 837.49
      }
    },
    "playerBodyHeight": 380,
    "walkArea": {
      "left": 100.32,
      "right": 1521.52,
      "top": 771.62,
      "bottom": 903.36
    },
    "exits": [
      {
        "id": "hk-home-next",
        "targetSceneId": "metro-carriage",
        "label": "the MTR",
        "x": 1228.92,
        "y": 799.85,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 1228.92,
          "y": 733
        }
      }
    ],
    "points": [
      {
        "id": "hk-home-object",
        "x": 555,
        "y": 150,
        "approach": {
          "x": 555,
          "y": 837.49
        },
        "label": "Home-by clock",
        "icon": "◷",
        "thought": "Where could today take us? Keep the way home in the picture before stepping outside.",
        "interactionId": "hk-home"
      }
    ]
  },
  "metro-carriage": {
    "title": "Inside the train",
    "placeLabel": "Illustrative rail carriage",
    "art": {
      "src": "art/metro-carriage.webp",
      "alt": "An original pixel-art metro carriage interior, with open end passages, simple route diagram, teal seats and ordinary commuters.",
      "approved": true
    },
    "playerStart": {
      "x": 267.52,
      "y": 785.735
    },
    "entryPoints": {
      "left": {
        "x": 267.52,
        "y": 785.735
      },
      "right": {
        "x": 267.52,
        "y": 785.735
      }
    },
    "playerBodyHeight": 255,
    "walkArea": {
      "left": 66.88,
      "right": 1605.12,
      "top": 696.34,
      "bottom": 875.13
    },
    "exits": [
      {
        "id": "metro-carriage-back",
        "targetSceneId": "hk-home",
        "label": "A day begins",
        "x": 142.12,
        "y": 785.735,
        "entryDirection": "right",
        "doorAnchor": {
          "x": 142.12,
          "y": 663.405
        }
      },
      {
        "id": "metro-carriage-next",
        "targetSceneId": "border-arrival",
        "label": "Futian arrival",
        "x": 836,
        "y": 785.735,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 836,
          "y": 470
        }
      }
    ],
    "points": [
      {
        "id": "metro-carriage-object",
        "x": 836.0,
        "y": 258.775,
        "approach": {
          "x": 836.0,
          "y": 785.735
        },
        "label": "Route above the door",
        "icon": "↔",
        "thought": "The train ride is only part of crossing. What happens before boarding and after leaving the station?",
        "interactionId": "metro-carriage"
      }
    ]
  },
  "border-arrival": {
    "title": "Across the boundary",
    "placeLabel": "Futian · illustrative arrival",
    "art": {
      "src": "art/border-arrival.webp",
      "alt": "A fictional pixel-art border arrival hall with open side corridors, generic passenger lanes, a public map board and waiting seats.",
      "approved": true
    },
    "playerStart": {
      "x": 267.52,
      "y": 771.62
    },
    "entryPoints": {
      "left": {
        "x": 267.52,
        "y": 771.62
      },
      "right": {
        "x": 267.52,
        "y": 771.62
      }
    },
    "playerBodyHeight": 195,
    "walkArea": {
      "left": 66.88,
      "right": 1605.12,
      "top": 696.34,
      "bottom": 846.9
    },
    "exits": [
      {
        "id": "border-arrival-back",
        "targetSceneId": "metro-carriage",
        "label": "Inside the train",
        "x": 183.92,
        "y": 771.62,
        "entryDirection": "right",
        "doorAnchor": {
          "x": 183.92,
          "y": 635.175
        }
      },
      {
        "id": "border-arrival-next",
        "targetSceneId": "parcel-counter",
        "label": "Get the parcel home",
        "x": 1566.664,
        "y": 771.62,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 1566.664,
          "y": 635.175
        }
      }
    ],
    "points": [
      {
        "id": "border-arrival-object",
        "x": 548.416,
        "y": 493.084,
        "approach": {
          "x": 548.416,
          "y": 771.62
        },
        "label": "Connection board",
        "icon": "?",
        "thought": "The crossing, the train and permission to enter are different checks. Which link have we actually checked?",
        "interactionId": "border-arrival"
      }
    ]
  },
  "parcel-counter": {
    "title": "Get the parcel home",
    "placeLabel": "Fictional collection counter",
    "art": {
      "src": "art/parcel-counter.webp",
      "alt": "A warm original pixel-art parcel pickup shop, with stocked shelves, a counter, ordinary workers, a street door and an open rear corridor.",
      "approved": true
    },
    "playerStart": {
      "x": 267.52,
      "y": 781.03
    },
    "entryPoints": {
      "left": {
        "x": 267.52,
        "y": 781.03
      },
      "right": {
        "x": 267.52,
        "y": 781.03
      }
    },
    "playerBodyHeight": 205,
    "walkArea": {
      "left": 66.88,
      "right": 1605.12,
      "top": 677.52,
      "bottom": 884.54
    },
    "exits": [
      {
        "id": "parcel-counter-back",
        "targetSceneId": "border-arrival",
        "label": "Across the boundary",
        "x": 120.384,
        "y": 781.03,
        "entryDirection": "right",
        "doorAnchor": {
          "x": 120.384,
          "y": 643.644
        }
      },
      {
        "id": "parcel-counter-next",
        "targetSceneId": "mall-foodcourt",
        "label": "A familiar frontage",
        "x": 1568.336,
        "y": 781.03,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 1568.336,
          "y": 611.65
        }
      }
    ],
    "points": [
      {
        "id": "parcel-counter-object",
        "x": 963.072,
        "y": 491.202,
        "approach": {
          "x": 963.072,
          "y": 781.03
        },
        "label": "Parcel and receipt",
        "icon": "▣",
        "thought": "Collecting a parcel may fit a trip you already planned. What changes if the parcel is the reason for crossing?",
        "interactionId": "parcel-counter"
      }
    ]
  },
  "mall-foodcourt": {
    "title": "A familiar frontage",
    "placeLabel": "Fictional food court",
    "art": {
      "src": "art/mall-foodcourt.webp",
      "alt": "A modest pixel-art mall food court with a familiar tea-cafe format, shared tables, a picture menu, and open mall corridors on both sides.",
      "approved": true
    },
    "playerStart": {
      "x": 267.52,
      "y": 799.85
    },
    "entryPoints": {
      "left": {
        "x": 267.52,
        "y": 799.85
      },
      "right": {
        "x": 267.52,
        "y": 799.85
      }
    },
    "playerBodyHeight": 210,
    "walkArea": {
      "left": 66.88,
      "right": 1605.12,
      "top": 715.16,
      "bottom": 884.54
    },
    "exits": [
      {
        "id": "mall-foodcourt-back",
        "targetSceneId": "parcel-counter",
        "label": "Get the parcel home",
        "x": 115.368,
        "y": 799.85,
        "entryDirection": "right",
        "doorAnchor": {
          "x": 115.368,
          "y": 656.818
        }
      },
      {
        "id": "mall-foodcourt-next",
        "targetSceneId": "neighborhood-lane",
        "label": "Between destinations",
        "x": 1568.336,
        "y": 799.85,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 1568.336,
          "y": 656.818
        }
      }
    ],
    "points": [
      {
        "id": "mall-foodcourt-object",
        "x": 561.792,
        "y": 552.367,
        "approach": {
          "x": 561.792,
          "y": 799.85
        },
        "label": "Menu and shopfront",
        "icon": "≡",
        "thought": "A familiar menu can attract neighbours, workers and visitors. How might the business respond if its customers changed?",
        "interactionId": "mall-foodcourt"
      }
    ]
  },
  "neighborhood-lane": {
    "title": "Between destinations",
    "placeLabel": "Fictional residential neighbourhood",
    "art": {
      "src": "art/neighborhood-lane.webp",
      "alt": "Pixel-art neighborhood park with a blank community noticeboard, bench, court, small residents, water fountain, bicycles and ordinary apartments behind trees.",
      "approved": true
    },
    "playerStart": {
      "x": 167.2,
      "y": 781.03
    },
    "entryPoints": {
      "left": {
        "x": 167.2,
        "y": 781.03
      },
      "right": {
        "x": 167.2,
        "y": 781.03
      }
    },
    "playerBodyHeight": 145,
    "walkArea": {
      "left": 66.88,
      "right": 1621.84,
      "top": 715.16,
      "bottom": 856.31
    },
    "exits": [
      {
        "id": "neighborhood-lane-back",
        "targetSceneId": "mall-foodcourt",
        "label": "Back toward the food court",
        "x": 66.88,
        "y": 781.03,
        "entryDirection": "right"
      },
      {
        "id": "neighborhood-lane-next",
        "targetSceneId": "urban-village",
        "label": "Explore the lane",
        "x": 1605.12,
        "y": 781.03,
        "entryDirection": "left"
      }
    ],
    "points": [
      {
        "id": "neighborhood-lane-object",
        "x": 443.08,
        "y": 508.14,
        "approach": {
          "x": 443.08,
          "y": 781.03
        },
        "label": "Neighbourhood noticeboard",
        "icon": "⌖",
        "thought": "Shops and a park look different when they become part of your week. What would you make time to return for?",
        "interactionId": "neighborhood-lane"
      }
    ]
  },
  "urban-village": {
    "title": "A lane of everyday uses",
    "placeLabel": "Fictional urban-village lane",
    "art": {
      "src": "art/urban-village.webp",
      "alt": "A fictional pixel-art urban-village lane with homes above a repair shop and grocery, residents going about ordinary tasks, and lanes continuing left and right.",
      "approved": true
    },
    "playerStart": {
      "x": 267.52,
      "y": 818.67
    },
    "entryPoints": {
      "left": {
        "x": 267.52,
        "y": 818.67
      },
      "right": {
        "x": 267.52,
        "y": 818.67
      }
    },
    "playerBodyHeight": 165,
    "walkArea": {
      "left": 66.88,
      "right": 1605.12,
      "top": 743.39,
      "bottom": 893.95
    },
    "exits": [
      {
        "id": "urban-village-back",
        "targetSceneId": "neighborhood-lane",
        "label": "Between destinations",
        "x": 118.712,
        "y": 818.67,
        "entryDirection": "right",
        "doorAnchor": {
          "x": 118.712,
          "y": 686.93
        }
      },
      {
        "id": "urban-village-next",
        "targetSceneId": "rental-home",
        "label": "Keys and a lease",
        "x": 1580.04,
        "y": 818.67,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 1580.04,
          "y": 686.93
        }
      }
    ],
    "points": [
      {
        "id": "urban-village-object",
        "x": 954.712,
        "y": 604.122,
        "approach": {
          "x": 954.712,
          "y": 818.67
        },
        "label": "Passage between buildings",
        "icon": "↗",
        "thought": "A useful home is connected to everyday places. What changes when the nearby passage is unavailable?",
        "interactionId": "urban-village"
      }
    ]
  },
  "rental-home": {
    "title": "Keys and a lease",
    "placeLabel": "Fictional rental home",
    "art": {
      "src": "art/rental-home.webp",
      "alt": "Pixel-art rental flat with an open corridor door, a table with papers and keys, moving boxes, a sofa and neighborhood windows.",
      "approved": true
    },
    "playerStart": {
      "x": 234.08,
      "y": 781.03
    },
    "entryPoints": {
      "left": {
        "x": 234.08,
        "y": 781.03
      },
      "right": {
        "x": 234.08,
        "y": 781.03
      }
    },
    "playerBodyHeight": 420,
    "walkArea": {
      "left": 117.04,
      "right": 1605.12,
      "top": 715.16,
      "bottom": 856.31
    },
    "exits": [
      {
        "id": "rental-home-back",
        "targetSceneId": "urban-village",
        "label": "Back to the lane",
        "x": 167.2,
        "y": 715.16,
        "entryDirection": "right"
      },
      {
        "id": "rental-home-next",
        "targetSceneId": "luxury-home",
        "label": "Visit the housing showroom",
        "x": 1605.12,
        "y": 715.16,
        "entryDirection": "left"
      }
    ],
    "points": [
      {
        "id": "rental-home-object",
        "x": 668.8,
        "y": 451.68,
        "approach": {
          "x": 595,
          "y": 781.03
        },
        "label": "Lease on the table",
        "icon": "⌂",
        "thought": "Some move-in money is spent; some may be held and returned. Which part is which in this example?",
        "interactionId": "rental-home"
      }
    ]
  },
  "luxury-home": {
    "title": "Behind the showroom",
    "placeLabel": "Fictional property showroom",
    "art": {
      "src": "art/luxury-home.webp",
      "alt": "Pixel-art housing showroom with a small apartment model, material sample wall, broad windows and clear side doorways.",
      "approved": true
    },
    "playerStart": {
      "x": 167.2,
      "y": 752.8
    },
    "entryPoints": {
      "left": {
        "x": 167.2,
        "y": 752.8
      },
      "right": {
        "x": 167.2,
        "y": 752.8
      }
    },
    "playerBodyHeight": 330,
    "walkArea": {
      "left": 66.88,
      "right": 1621.84,
      "top": 686.93,
      "bottom": 828.08
    },
    "exits": [
      {
        "id": "luxury-home-back",
        "targetSceneId": "rental-home",
        "label": "Back to the rental flat",
        "x": 133.76,
        "y": 686.93,
        "entryDirection": "right"
      },
      {
        "id": "luxury-home-next",
        "targetSceneId": "office-floor",
        "label": "Visit the office",
        "x": 1605.12,
        "y": 677.52,
        "entryDirection": "left"
      }
    ],
    "points": [
      {
        "id": "luxury-home-object",
        "x": 869.44,
        "y": 423.45,
        "approach": {
          "x": 869.44,
          "y": 752.8
        },
        "label": "Home model and payment",
        "icon": "◇",
        "thought": "A polished home is also a financial commitment. What part of a payment buys use, and what part reduces debt?",
        "interactionId": "luxury-home"
      }
    ]
  },
  "office-floor": {
    "title": "A quiet floor",
    "placeLabel": "Fictional commercial building",
    "art": {
      "src": "art/office-floor.webp",
      "alt": "Pixel-art office with an available front workdesk, two small background workers, some empty chairs, evening windows, a meeting room and side corridor doorways.",
      "approved": true
    },
    "playerStart": {
      "x": 167.2,
      "y": 771.62
    },
    "entryPoints": {
      "left": {
        "x": 167.2,
        "y": 771.62
      },
      "right": {
        "x": 167.2,
        "y": 771.62
      }
    },
    "playerBodyHeight": 330,
    "walkArea": {
      "left": 66.88,
      "right": 1621.84,
      "top": 705.75,
      "bottom": 846.9
    },
    "exits": [
      {
        "id": "office-floor-back",
        "targetSceneId": "luxury-home",
        "label": "Back to the showroom",
        "x": 150.48,
        "y": 677.52,
        "entryDirection": "right"
      },
      {
        "id": "office-floor-next",
        "targetSceneId": "learning-center",
        "label": "Visit the learning center",
        "x": 1605.12,
        "y": 686.93,
        "entryDirection": "left"
      }
    ],
    "points": [
      {
        "id": "office-floor-object",
        "x": 718.96,
        "y": 395.22,
        "approach": {
          "x": 718.96,
          "y": 771.62
        },
        "label": "Office notebook",
        "icon": "▦",
        "thought": "An empty-looking room tells us what was visible then. Does it tell us whether the space was leased?",
        "interactionId": "office-floor"
      }
    ]
  },
  "learning-center": {
    "title": "A class after work",
    "placeLabel": "Fictional adult learning centre",
    "art": {
      "src": "art/learning-center.webp",
      "alt": "An original pixel-art adult learning room with a tutor, adult learners, desks, a blank noticeboard and open doors on both sides.",
      "approved": true
    },
    "playerStart": {
      "x": 267.52,
      "y": 804.555
    },
    "entryPoints": {
      "left": {
        "x": 267.52,
        "y": 804.555
      },
      "right": {
        "x": 267.52,
        "y": 804.555
      }
    },
    "playerBodyHeight": 255,
    "walkArea": {
      "left": 66.88,
      "right": 1605.12,
      "top": 724.57,
      "bottom": 884.54
    },
    "exits": [
      {
        "id": "learning-center-back",
        "targetSceneId": "office-floor",
        "label": "A quiet floor",
        "x": 71.896,
        "y": 804.555,
        "entryDirection": "right",
        "doorAnchor": {
          "x": 71.896,
          "y": 658.7
        }
      },
      {
        "id": "learning-center-next",
        "targetSceneId": "planning-museum",
        "label": "Whose centre is this?",
        "x": 1621.84,
        "y": 804.555,
        "entryDirection": "left",
        "doorAnchor": {
          "x": 1621.84,
          "y": 658.7
        }
      }
    ],
    "points": [
      {
        "id": "learning-center-object",
        "x": 483.208,
        "y": 325.586,
        "approach": {
          "x": 483.208,
          "y": 804.555
        },
        "label": "Class on the calendar",
        "icon": "◷",
        "thought": "An opportunity can be nearby and still hard to use. Does this class fit around the rest of the day?",
        "interactionId": "learning-center"
      }
    ]
  },
  "planning-museum": {
    "title": "Whose centre is this?",
    "placeLabel": "Illustrative planning exhibition",
    "art": {
      "src": "art/planning-museum.webp",
      "alt": "Pixel-art planning museum with a large unlabeled abstract city map, miniature varied city model, blank exhibit pedestal and open side galleries.",
      "approved": true
    },
    "playerStart": {
      "x": 167.2,
      "y": 781.03
    },
    "entryPoints": {
      "left": {
        "x": 167.2,
        "y": 781.03
      },
      "right": {
        "x": 167.2,
        "y": 781.03
      }
    },
    "playerBodyHeight": 315,
    "walkArea": {
      "left": 66.88,
      "right": 1621.84,
      "top": 715.16,
      "bottom": 856.31
    },
    "exits": [
      {
        "id": "planning-museum-back",
        "targetSceneId": "learning-center",
        "label": "Back toward the learning center",
        "x": 100.32,
        "y": 696.34,
        "entryDirection": "right"
      },
      {
        "id": "planning-museum-next",
        "targetSceneId": "neighborhood-lane",
        "label": "Return to the neighborhood",
        "x": 1605.12,
        "y": 686.93,
        "entryDirection": "left"
      }
    ],
    "points": [
      {
        "id": "planning-museum-object",
        "x": 1036.64,
        "y": 291.71,
        "approach": {
          "x": 1036.64,
          "y": 781.03
        },
        "label": "Layered city model",
        "icon": "▧",
        "thought": "A plan shows possibilities. What changes when a proposed connection is drawn as though it already exists?",
        "interactionId": "planning-museum"
      }
    ]
  }
};
