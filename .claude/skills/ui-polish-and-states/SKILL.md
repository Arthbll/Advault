---
name: ui-polish-and-states
description: Use this skill when refining empty states, error states, sync problems, resume flows, and premium product polish across ProfitDash.
---

# ProfitDash UI Polish and States Skill

Use this skill whenever you are:
- designing empty states
- designing error states
- handling sync issues
- polishing operational modals
- refining premium product UX

## Goal

Make secondary states feel intentional, premium, and helpful.
No dead screens. No broken-feeling UI. No bland admin fallback states.

## Empty state principles

An empty state must answer:
1. What is this section for?
2. Why is it empty?
3. What should the user do next?

Examples:
- Vault empty → add asset / add route
- Transactions empty → check postbacks / validate signal
- Analytics empty → wait for enough data / open campaigns
- Campaign detail assets empty → attach assets / open vault

## Error and sync state principles

An error state must answer:
1. What broke?
2. What is affected?
3. What can the user do next?

Examples:
- network disconnected
- expired API token
- postback unhealthy
- no data after sync
- partial source outage
- rate limit reached

## Resume / New / Archive principles

If the user clicks New campaign while a paused campaign is relevant, the decision UI must clearly distinguish:
- Resume current campaign
- Start a new campaign from scratch
- Archive campaign

Do not make this a tiny, forgettable action.
Make it feel intentional and operationally clear.

Archive behavior:
- removes campaign from active flow
- keeps campaign in archived bucket
- preserves historical visibility

## Visual polish rules

Prefer:
- strong hierarchy
- elegant cards
- restrained accent colors
- dark, premium surfaces
- clear CTA priority

Avoid:
- lifeless empty screens
- giant warning banners with no recovery path
- generic admin alerts
- ugly browser-native-feeling controls when better UI is possible

## Final check

Every low-data or broken state should still make the product feel expensive, calm, and under control.
