// v1.14.0 mobile shell: is the on-screen keyboard (likely) open? Tracks focus on text
// inputs. Used to hide floating chrome so question and answer own the screen.
import { writable } from 'svelte/store';

export const keyboardOpen = writable(false);

function isTextTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'textarea' || (tag === 'input' && !['checkbox', 'radio', 'button', 'range', 'submit'].includes((el as HTMLInputElement).type)) || el.isContentEditable;
}

export function attachKeyboardWatcher(): () => void {
  const onIn = (e: FocusEvent) => { if (isTextTarget(e.target)) keyboardOpen.set(true); };
  const onOut = () => {
    setTimeout(() => { if (!isTextTarget(document.activeElement)) keyboardOpen.set(false); }, 80);
  };
  window.addEventListener('focusin', onIn);
  window.addEventListener('focusout', onOut);
  return () => { window.removeEventListener('focusin', onIn); window.removeEventListener('focusout', onOut); };
}
