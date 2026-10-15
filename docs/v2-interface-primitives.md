# TaskFlow interface primitives

[#102](https://github.com/garrib10/taskflow/issues/102), under #20, builds on the merged [token foundation](v2-design-tokens.md) and approved #19/#94–#96 flows. These are three small application components, not a design-system package. Import each directly from `src/components/ui`; each owns its CSS and consumes existing tokens.

## Audit and extraction decisions

| Current repetition | Decision |
| --- | --- |
| Task, relationship and confirmation action pairs duplicate sizing, primary/neutral/destructive colors and focus/disabled rules | Extract `Button`; migrate those action pairs. Use explicit variants instead of inferring meaning from first/last child position. |
| Title/description/parent fields repeat visible label plus native control grouping and vertical rhythm | Extract `Field` layout/label; migrate these three fields. Keep native control attributes, counters, validation and IDs explicit in the feature. |
| Priority/category/Done badges repeat inline layout, radius and typography | Extract `Badge` layout; migrate card metadata. Feature classes still determine palette and text. |
| Notification already owns typed text/icon, live semantics, dismissal and focus fallback | Retain it. One dismiss control does not justify a separate icon-button API here. Future icon-only controls still need explicit accessible names. |
| Confirmation already owns named dialog, consequence text and focus/restoration | Retain its behavior and `useModalFocus`; replace only its action buttons. |
| Task forms own dirty state, nested related-task navigation and domain feedback | Retain feature ownership. No generic modal/form controller or validation engine. |
| Empty column, filtered results and storage recovery have different actions/data-safety meaning | Keep local; #96's distinct states should not become one generic empty-state message. |
| Board/card/dialog surfaces have different scrolling, interaction and focus obligations | Keep local; no decorative `Panel` wrapper or shell extraction. |
| `.visually-hidden`, existing progress and native search/select controls already work | Keep them; no helper component, loading skeleton or control replacement without actual need. |

The new components do not change workflow, priority, capacity, relationship or persistence decisions. Description remains required in the current form; #95's future optional-description behavior is not implemented by this extraction.

## APIs and usage

- **Button:** native `<button>` props/ref, plus `variant="primary" | "secondary" | "danger"`. Default type is `button`; supply `type="submit"` for form submission. Native `disabled`, event handlers, `data-initial-focus`, ARIA and accessible children pass through. No custom keyboard activation, busy/selected/toggle logic, `as` API or feature rules. Native `aria-pressed` can be supplied when a later real interaction warrants it.
- **Field:** native wrapper `<div>` props/ref plus `controlId`, `label` and children. Match the child's native `id` to `controlId`. Pass input/select/textarea props to that actual control, not the wrapper. Keep help/error nodes and matching `aria-describedby`/`aria-invalid` on the native control explicit; the frame never clones children, invents IDs, duplicates alerts or decides validation. Existing focus targets and external summary associations stay intact.
- **Badge:** native `<span>` props/ref/children and feature `className`. Supplies metadata layout only. Always provide meaningful visible text; feature owners supply semantic colors/status context. It is neither an interactive control nor an automatic live region.

```tsx
<Field controlId="task-title" label="Title">
  <input id="task-title" aria-describedby="title-help" required />
  <small id="title-help">3–150 characters</small>
</Field>
<Button variant="secondary" onClick={cancel}>Cancel</Button>
<Button type="submit">Save Changes</Button>
<Badge className="badge-medium">Medium</Badge>
```

Form drafts, error content, association IDs, submission and dialog lifecycle remain in their existing owners. Search icon geometry, slim card actions, relationship links and editor status pills remain local rather than expanding the variant set.

## States and accessibility

Button uses token-backed default/hover/active/focus/disabled presentation and a 44px minimum target. Disabled hover/active cannot regain enabled styling; native disabled controls leave the tab sequence. Secondary actions now share the same neutral surface and visible border, including confirmation Cancel. Dialog actions no longer depend on DOM order for their variant.

Focus retains the #101 outline/halo. `useModalFocus` and modal markup/initial-focus attributes are unchanged. Only current button semantics are extracted; existing tests still exercise initial Cancel, Tab containment, Escape, background isolation and restoration. Reduced-motion overrides remove Button transitions; existing dialog/card overrides remain.

Field preserves label activation, required/native input semantics, counters, error associations and focus after rejection. Badge meaning stays textual; colors do not replace task/priority/category labels. No new automatic announcements compete with existing feedback.

## Verification

Seven new behavioral tests cover native prop/ref/event forwarding, keyboard activation, disabled behavior, explicit submit intent, variant classes, label/help/error associations, native select use and textual badge semantics. Existing confirmation/relationship/form tests remain unchanged.

- Focused primitive and migrated-dialog tests: **12 passed / 6 files**.
- Full suite: **304 passed / 28 files**; lint, strict type-check, production build and diff whitespace check passed.
- Existing production Chromium journeys: **6 passed**, desktop/mobile.
- Baseline/final captures cover board, focused creation, validation, success and delete confirmation at **1440, 768, 390, 375, 320px** widths. Board/header/card/column/control geometry stays unchanged, no page overflow or application exceptions; representative desktop/mobile captures inspected. Field grouping preserves existing spacing; dialog buttons intentionally gain consistent variants/borders.
- Existing **56 token contrast pairs** still pass (text minimum 4.57:1; focus/control boundary minimum 3.48:1). Parent focus and disabled relationship Save hover checked separately; reduced-motion token/card behavior confirmed. This is local Chromium evidence, not physical-mobile or screen-reader certification.

## Next ownership

#103 implements the application shell/toolbar. #44–#46 implement compact cards, read-first details, redesigned forms and board controls; they can migrate more uses when doing that work. #47 verifies assembled interaction/focus/touch/zoom/short-height/speech behavior. No shell, board, detail redesign, new feature, dependency or theme architecture begins here.
