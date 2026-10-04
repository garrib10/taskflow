import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react";

const focusable = 'button, input, textarea, select, a[href], summary, [tabindex]';
interface ModalEntry { element: HTMLElement; trigger: HTMLElement | null; lastFocus: HTMLElement | null; fallbackTriggers: HTMLElement[]; }
const stack: ModalEntry[] = [];
const entries = new WeakMap<HTMLElement, ModalEntry>();
const isolated = new Map<HTMLElement, boolean>();
export function canFocus(element: HTMLElement | null): element is HTMLElement {
  return !!element?.isConnected && !element.closest('[hidden], [inert]') &&
    !element.matches(':disabled') && getComputedStyle(element).display !== 'none';
}
function controls(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(focusable))
    .filter(node => node.tabIndex >= 0 && canFocus(node));
}
function isolate() {
  isolated.forEach((wasInert, node) => { node.inert = wasInert; if (!wasInert) node.removeAttribute('inert'); });
  isolated.clear();
  let node: HTMLElement | undefined = stack.at(-1)?.element;
  while (node?.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling instanceof HTMLElement && sibling !== node && !sibling.hasAttribute("data-live-region")) {
        isolated.set(sibling, sibling.inert || sibling.hasAttribute('inert'));
        sibling.inert = true;
        sibling.setAttribute('inert', '');
      }
    }
    node = node.parentElement;
  }
}
function enter(entry: ModalEntry) {
  const replacement = entry.lastFocus?.id ? document.getElementById(entry.lastFocus.id) : null;
  const target = canFocus(entry.lastFocus) ? entry.lastFocus :
    canFocus(replacement) && entry.element.contains(replacement) ? replacement :
    entry.element.querySelector<HTMLElement>('[data-initial-focus]') ?? controls(entry.element)[0] ?? entry.element;
  target.focus();
}
/** Shared by task, relationship and confirmation dialogs; only the active modal handles keys. */
export function useModalFocus(ref: RefObject<HTMLElement | null>, onEscape: () => void, enabled = true) {
  const saved = useRef<ModalEntry | null>(null);
  const escape = useEffectEvent(onEscape);
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const trigger = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const parentDialog = trigger?.closest<HTMLElement>('[role="dialog"]');
    const parentEntry = parentDialog ? entries.get(parentDialog) : undefined;
    const entry = saved.current ?? { element: ref.current, trigger, lastFocus: null,
      fallbackTriggers: parentEntry ? [parentEntry.trigger, ...parentEntry.fallbackTriggers].filter((node): node is HTMLElement => !!node) : [] };
    saved.current = entry;
    entries.set(entry.element, entry);
    stack.push(entry);
    isolate();
    enter(entry);
    function keydown(event: KeyboardEvent) {
      if (stack.at(-1) !== entry) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); escape(); }
      if (event.key === 'Tab') {
        const items = controls(entry.element);
        const current = document.activeElement;
        if (!items.length) { event.preventDefault(); entry.element.focus(); }
        else if (event.shiftKey && (current === items[0] || !items.includes(current as HTMLElement))) {
          event.preventDefault(); items.at(-1)?.focus();
        } else if (!event.shiftKey && (current === items.at(-1) || !items.includes(current as HTMLElement))) {
          event.preventDefault(); items[0].focus();
        }
      }
    }
    function focusin(event: FocusEvent) {
      if (stack.at(-1) !== entry) return;
      if (event.target instanceof HTMLElement && entry.element.contains(event.target)) entry.lastFocus = event.target;
      else enter(entry);
    }
    const observer = new MutationObserver(records => {
      // Text/count updates inside the dialog cannot expose new background controls.
      const addedBackground = records.some(record => Array.from(record.addedNodes)
        .some(node => node instanceof HTMLElement && !entry.element.contains(node)));
      if (stack.at(-1) === entry && addedBackground) isolate();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin, true);
    return () => {
      observer.disconnect();
      const wasTop = stack.at(-1) === entry;
      stack.splice(stack.indexOf(entry), 1);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin, true);
      isolate();
      if (!wasTop) return;
      // React removes DOM nodes after effect cleanup. Restore after the commit, never to a departing trigger.
      queueMicrotask(() => {
        const active = stack.at(-1);
        const current = document.activeElement;
        if (current instanceof HTMLElement && current !== document.body && canFocus(current) && !entry.element.contains(current)) return;
        const target = [entry.trigger, ...entry.fallbackTriggers].find(node => canFocus(node) && (!active || active.element.contains(node)));
        if (target) target.focus();
        else if (active) enter(active);
        else document.querySelector<HTMLElement>('[data-focus-fallback]')?.focus();
      });
    };
  }, [enabled, ref]);
}
