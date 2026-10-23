import { describe, expect, it } from 'vitest';
import { isEditableTarget, keyAction, type KeyState } from '../../src/ui/keys';

const base: KeyState = { popupOpen: false, confirmOpen: false, blocked: false, targetEditable: false };
const st = (o: Partial<KeyState> = {}): KeyState => ({ ...base, ...o });

describe('keyAction', () => {
  it('Esc and P (any case) open the popup during play', () => {
    for (const k of ['Escape', 'Esc', 'p', 'P']) expect(keyAction(k, st())).toBe('open');
  });
  it('Esc and P close the popup; Space = Tiếp tục', () => {
    for (const k of ['Escape', 'p', 'P', ' ', 'Spacebar']) expect(keyAction(k, st({ popupOpen: true }))).toBe('close');
  });
  it('Space does nothing when the popup is closed', () => {
    expect(keyAction(' ', st())).toBeNull();
  });
  it('quiz, result screen or halted run (blocked) cannot open the popup', () => {
    for (const k of ['Escape', 'p', ' ']) expect(keyAction(k, st({ blocked: true }))).toBeNull();
  });
  it('inside a confirm box Esc = Không; P and Space do nothing', () => {
    const c = st({ popupOpen: true, confirmOpen: true });
    expect(keyAction('Escape', c)).toBe('cancelConfirm');
    expect(keyAction('p', c)).toBeNull();
    expect(keyAction(' ', c)).toBeNull();
  });
  it('ignores keys typed into an input/textarea/contenteditable target in every state', () => {
    for (const o of [{}, { popupOpen: true }, { popupOpen: true, confirmOpen: true }, { blocked: true }]) {
      for (const k of ['Escape', 'p', 'P', ' ']) expect(keyAction(k, st({ ...o, targetEditable: true }))).toBeNull();
    }
  });
  it('ignores modifier combos (Ctrl+P prints) and key repeat', () => {
    expect(keyAction('p', st({ modifier: true }))).toBeNull();
    expect(keyAction('Escape', st({ repeat: true }))).toBeNull();
    expect(keyAction('Escape', st({ popupOpen: true, repeat: true }))).toBeNull();
  });
  it('ignores other keys', () => {
    for (const k of ['a', 'Enter', 'Tab', 'ArrowUp']) expect(keyAction(k, st({ popupOpen: true }))).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('detects input, textarea, select and contenteditable', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'textarea' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });
  it('rejects the canvas, body, null and odd values', () => {
    expect(isEditableTarget({ tagName: 'CANVAS' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BODY', isContentEditable: false })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
    expect(isEditableTarget('input')).toBe(false);
  });
});
