# Connected world integration

Entry: world.html → src/world-main.tsx → src/world/WorldApp.tsx.

Shell owns src/world/types.ts, interaction-contract.ts, scene-registry.ts, model.ts, WorldApp.tsx, world.css, assets.ts and build/export config. The interaction worker owns src/world/interactions/** exclusively and exports `WorldInteraction` from src/world/interactions/index.tsx accepting `InteractionProps` from ../types. Use interactionId = sceneId unless content requires another stable ID. Shell retains `values` per interaction ID on revisits. `onChange(nextValues)` replaces that one record, not context or other interaction values. Do not import legacy sessions, domain assumptions, persistence, styles or art resolvers.

Scene IDs are exported in SCENE_IDS. Context is {party: 'two-friends' | 'solo' | 'couple' | 'older-couple' | 'family', day: 'weekend' | 'weekday', scenario: 'fieldtrip' | 'daily-life' | 'housing'}. Family is explicitly a fictional two-adult/one-child cast. No fare, eligibility, accessibility, preference or salary can be inferred from the cast. Runtime uses in-tab state only.

Every scene has a main semantic point. Scene artwork and all anchors use a 1672×941 normalized source plane. Mobile camera follows the player; it never translates props separately. Author geometry in scene-registry.ts. Scene art slots are public-world/art/<sceneId>.webp. Art must be approved and integrated by the lead before approved is enabled. Until then, the functional schematic is labelled. Schematic scenes do not count as delivered distinct illustrations.

Independent commands will be npm run dev:world, build:world, test:world, export:world. Legacy entries and all legacy source remain intact. Export must embed only approved world assets, sprite sheets, fonts and public evidence. No external requests are required to play the standalone HTML.
