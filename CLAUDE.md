# ProfitDash

## Product identity

ProfitDash is a decision engine for media buyers.
It is not a generic dashboard.
It connects ad networks and revenue sources, computes real profit, and helps users operate campaigns with automation logic.

Core product pillars:
1. campaign execution
2. real profit visibility
3. automation logic
4. operational clarity

## What ProfitDash is NOT

- not a generic analytics suite
- not a simple tracker
- not a finance backoffice
- not just a campaign launcher
- not a collection of unrelated pretty pages

## Product model

### Dashboard
Immediate operating view.
Shows what matters now:
- live performance
- active issues
- current engine actions
- quick operational shortcuts

Dashboard must not replace Analytics, Transactions, or Decision Rules.

### Campaigns
Main operating list of campaigns.
Each campaign must lead to a Campaign Detail page.
New campaign flow should be direct and intentional.
If a paused campaign requires a decision, show the resume/new/archive decision modal only when relevant.

### Campaign Detail
Single-campaign operating view.
Must connect:
- performance
- engine profile / rules
- assets / routes
- filtered revenue events
- metadata

### Wizard
Used to create campaigns.
Should stay launch-oriented and feel better than creating directly in ad networks.

### Preview
Separate from the wizard steps.
Used to preview how the ad format renders.
Must receive actual context from selected format, route, and creative.

### Vault
Operating inventory for assets and routes.
Not dead storage.
Assets and URLs must connect to campaigns and preview flows.

### Transactions
Revenue events received through affiliate postbacks.
Not invoices, not accounting, not payment history.
This is the money signal feeding real profit.

### Analytics
Strategic analysis layer.
Used to understand patterns over time.
Not a second dashboard.
Not a transactions clone.

### Decision Rules
Logic layer behind engine behavior.
Full editing belongs on a dedicated page.
Dashboard and Campaign Detail only show compact summaries.

### Settings
A section, not one giant page.
Must include:
- Overview
- Connections
- Postbacks
- Engine Defaults
- Team & Roles
- Security

### Resume / New / Archive flow
When relevant, clicking New campaign can trigger a decision modal.
The modal must clearly differentiate:
- Resume current campaign
- Start a new campaign from scratch
- Archive current campaign

Archived campaigns:
- leave active operating flow
- remain accessible in history / filters / analytics
- are not deleted

## Visual direction

ProfitDash should feel:
- premium
- dark
- clean
- deliberate
- operator-focused
- confident

Avoid:
- generic enterprise admin feel
- ugly form walls
- visual clutter
- oversized fake charts with no meaning
- random components without page purpose

## UX principles

- every page must have a clear role
- pages must connect to each other naturally
- avoid dead ends
- empty states must guide the next action
- error states must explain what broke and what is affected
- important actions should feel intentional, not hidden in tiny buttons
- clarity beats cleverness
- cohesion beats extra decoration

## Functional architecture rules

- clicking campaigns always opens Campaign Detail
- Transactions should link back to the related campaign
- Analytics should support drill-down to campaigns / networks / geos when relevant
- Vault assets and routes should be attachable to campaigns
- Preview must receive real context
- Settings must expose trust signals: connections, postbacks, defaults, permissions
- Dashboard should surface live issues but defer deep editing to dedicated pages

## Implementation priorities

When choosing between:
- adding more visual polish
- or improving product coherence and page relationships

always prioritize product coherence.

## Terminology rules

Use these consistently:
- Transactions = revenue events / postback events
- Analytics = strategic performance analysis
- Dashboard = real-time operating view
- Vault = assets and routes inventory
- Decision Rules = engine logic controls
- Campaign Detail = single campaign operating page

Do not rename these inconsistently.

## Coding behavior

Before building new UI:
1. inspect existing routes, components, and data flow
2. reuse existing patterns when possible
3. preserve the current visual system
4. connect new work to real product flows
5. avoid isolated mockup-style additions

## Final mindset

Make ProfitDash feel like one real product.
Every page must know:
- why it exists
- what user job it solves
- what it links to
- what the next action should be
