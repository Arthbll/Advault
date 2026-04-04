---
name: feature-wiring
description: Use this skill when you need to connect ProfitDash pages, routes, buttons, and flows so the app feels like one coherent working system.
---

# ProfitDash Feature Wiring Skill

Use this skill whenever you are:
- wiring routes
- connecting CTA buttons
- linking pages together
- improving navigation
- handling selected campaign context
- fixing isolated features

## Goal

Connect features intelligently.
Do not leave pages or buttons as visual dead ends.

## Wiring rules

### Campaign flows
- Campaign list items must open Campaign Detail
- Dashboard campaign references should deep-link to Campaign Detail
- Analytics campaign rows or cards should support campaign drill-down
- Transactions rows should link back to the source campaign when available

### Vault flows
- Vault assets and routes must be attachable to campaigns
- Campaign Detail should expose linked assets and routes
- Preview should be able to consume selected creative / route context

### Decision Rules flows
- Dashboard can show a compact summary of active thresholds
- Campaign Detail can show the applied profile or override
- full editing belongs on Decision Rules page

### Settings flows
- Settings Overview should route to sub-pages
- broken connections or unhealthy signal should link to the correct settings location

### New campaign flow
- clicking New campaign normally opens the wizard
- if a paused campaign decision is relevant, intercept with the resume/new/archive modal
- archive moves the campaign to Archived, not deletion

## Dead-end prevention checklist

Before finishing, verify:
- every major CTA opens something meaningful
- every table row that should drill down actually does
- every page has at least one sensible next step
- empty states include useful actions
- error states include a fix path

## Data and state consistency

If backend logic is incomplete:
- still create believable local flow
- keep naming consistent
- avoid fake buttons that do nothing
- prefer routed placeholders over dead UI

## Final test question

Can a user go from:
- campaign list
- to campaign detail
- to assets / rules / transactions / analytics
- and back again

without getting lost?

If not, keep wiring.
