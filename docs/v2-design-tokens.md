# TaskFlow v2 design tokens

[#101](https://github.com/garrib10/taskflow/issues/101) establishes a light, single-board foundation under #20. It follows the approved #18/#19 direction and the detailed #94–#96 contracts. The interface stays task-focused: readable hierarchy, restrained surfaces and elevation, clear controls and accessible feedback. This is incremental preparation, not the shell, card or detail redesign.

## Audit and ownership

v1.5 already separates component CSS, shared controls/dialogs and global resets. `index.css` held a small palette/radius/shadow set; most control, badge, feedback, typography and motion values remained repeated literals. Existing reduced-motion overrides and the 600/1024px layouts were already present. Form focus suppressed the global outline, and light field borders did not provide a strong control boundary.

`src/styles/tokens.css` now owns shared values, imported once through `index.css`. Component styles keep selectors, layout, responsive rules and feature ownership. Board, columns, task cards, Search/filter controls, task/relationship forms, confirmations, notifications and the existing legacy checklist consume tokens. No domain/persistence code or presentation-map classes change.

## Token categories

| Tokens | Intended use |
| --- | --- |
| `--color-canvas`, `--color-surface*`, `--color-text-*`, `--color-border` | Application background, panels/inset areas, reading hierarchy and decorative dividers |
| `--color-control-border*`, `--color-action-*` | Field boundaries, primary/secondary/quiet/destructive actions, hover/active/disabled presentation |
| `--color-selected-*`, `--color-focus*` | Existing related-task interactive context and future selected-task cue; keyboard focus is a separate treatment |
| `--color-feedback-{success,warning,info,error}-*`, `--color-validation-*` | Typed notifications and actionable validation; never substitute a priority or stage role |
| `--color-priority-*`, `--color-category-*` | Existing labeled task metadata; accent borders and badge text have separate contrast needs |
| `--color-stage-*`, `--color-completion-*`, `--color-progress-*` | Workflow presentation and derived progress; the existing generic non-Done status pill is retained, not newly differentiated by stage |
| `--color-capacity-{available,near,full,over}-*` | Approved #99 presentation for later #44 integration; these tokens neither implement limits nor change workflow |
| `--font-family-body`, `--font-size-*`, `--font-weight-*`, `--line-height-*` | Existing system font stack; identity, panel/section headings, task titles, body, labels, support and metadata hierarchy |
| `--space-*`, `--size-*` | Small 4/8/12/16/20/24/32px rhythm at the default root size; shared touch target and existing board/dialog constraints |
| `--radius-*`, `--border-width`, `--shadow-*`, `--overlay-*` | Control/panel/column shape and restrained existing elevation; pills only for compact state/metadata cues |
| `--focus-*`, `--motion-duration-*`, `--motion-easing` | Focus geometry and brief interaction/entry feedback |

Colors are semantic roles, not a numbered palette or theme API. Two roles may deliberately share a swatch: capacity warning and a warning notification still have different meaning and ownership. Aliases such as capacity-to-feedback avoid duplicate raw values without coupling domain rules. Spacing/weight/duration scales are shared primitive values; consuming selectors supply context. Do not add a second raw-color palette unless real reuse warrants it.

Consume a shared token when a value describes a repeated role or an explicitly approved future state. Keep one-off geometry, icon size, drag transform, truncation, scroll mechanics and component-specific offsets local. No token is a JavaScript constant, persistence field or replacement for domain validation.

## Accessibility and motion

- Existing text, labels, notification prefixes/icons and task metadata remain. Color never supplies the only meaning. Later capacity/stage/selection controls must add the #94/#96 text, reasons and accessible state; swatches alone do not implement that contract.
- Field borders use `--color-control-border` rather than decorative divider color. Text uses the appropriate foreground/surface pair. Pale badge/button edges are decorative where readable labels already identify the control.
- Focus uses a 3px blue outline with an offset and a white inner halo. Form fields no longer suppress the outline; parent-navigation focus uses the same strong treatment. Notification dismissal retains its contrast-tested feedback text color for the outline. Do not clip focus or remove it for compactness.
- Existing 44px button targets are preserved; dialog fields now also have a 44px minimum. The slim card action background does not shrink its real target. Existing checklist geometry is not redesigned here; its legacy smaller controls remain a follow-up input/target review for #47.
- Disabled Reset/relationship Save use readable disabled colors and existing native `disabled` semantics, instead of opacity alone. They cannot regain hover/active primary styling while disabled.
- Reduced-motion media queries zero shared durations; existing component overrides still disable entry animations/hover transforms and keep scrolling automatic. New consumers must use these durations and remove nonessential movement under the same preference. No global animation reset or timer/notification behavior change is introduced.

CSS variables cannot be interpolated into native media-query conditions. Existing 600px, 1024px and board-scroll-hint query boundaries remain in their owning styles; #103 owns deliberate new responsive behavior. Shared size tokens describe content constraints, not a pretend breakpoint API. The existing root font size remains browser-relative and supports text scaling.

## Verification for this change

- `npm test`: **297 tests / 25 files passed**. ESLint, strict TypeScript and production build passed.
- Existing production Chromium journeys: **6 passed**, desktop 1280×720 and mobile-sized 390×844.
- Local baseline/token production comparison captured board, focused creation, validation, success and deletion confirmation at widths **1440, 768, 390, 375 and 320** (844px height). All five widths retained board/header/card/column/control geometry and avoided page overflow. Representative desktop and narrow/mobile captures were visually inspected; dialog field height and focus/borders changed intentionally.
- Computed sRGB foreground/background verification covered **56 pairs**: role text pairs ≥4.5:1 (minimum **4.57:1**); selected focus surfaces and field boundaries ≥3:1 (minimum **3.48:1**). Ratios use relative luminance, `(lighter + 0.05) / (darker + 0.05)`, from browser-resolved colors, including semantic aliases. This checks the listed foundation pairs, not every possible composed future UI.
- Reduced-motion emulation resolved durations to zero and disabled card transition. No application exceptions occurred in the comparison journeys.

## Deferred work

#102 owns justified reusable primitives and their complete interaction states. #103 owns the redesigned shell/toolbar and exact responsive fit. #44–#46 implement compact cards, read-first drawer/sheet, mobile stage navigation and the new capacity/ordering controls. New stage and capacity tokens are the narrowly approved preparation for those states, not implemented features.

Keep current radii/shadows and component layout until those scoped migrations can be reviewed. #47 must verify actual screen-reader speech, physical touch/mobile keyboards, short heights, zoom, target spacing and focus against the assembled redesign; its existing legacy checklist target/focus review remains separate. Validate contrast again for newly composed surfaces/selected/drop states. No dark mode, theme switch, fonts/packages, optimization or backend features are introduced.
