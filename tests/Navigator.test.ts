import { createNavigator } from '../src/ui/Navigator';

describe('Navigator', () => {
  it('starts at the initial route with no params', () => {
    const nav = createNavigator('loading');
    expect(nav.current).toEqual({ route: 'loading', params: undefined });
    expect(nav.canGoBack).toBe(false);
  });

  it('navigate pushes a new screen and back pops it', () => {
    const nav = createNavigator('game');
    nav.navigate('auction');
    expect(nav.current.route).toBe('auction');
    expect(nav.canGoBack).toBe(true);

    nav.back();
    expect(nav.current.route).toBe('game');
    expect(nav.canGoBack).toBe(false);
  });

  it('back at the root is a no-op', () => {
    const nav = createNavigator('loading');
    nav.back();
    expect(nav.current.route).toBe('loading');
    expect(nav.canGoBack).toBe(false);
  });

  it('reaches every screen and unwinds the stack via back', () => {
    const nav = createNavigator('loading');
    nav.navigate('character-creation');
    nav.navigate('game');
    nav.navigate('personnel');
    expect(nav.current.route).toBe('personnel');

    nav.back();
    expect(nav.current.route).toBe('game');
    nav.navigate('auction');
    expect(nav.current.route).toBe('auction');
    nav.back();
    expect(nav.current.route).toBe('game');
  });

  it('pushes the department screen with its dept param and pops back to game', () => {
    const nav = createNavigator('game');
    nav.navigate('department', { dept: 'service' });
    expect(nav.current.route).toBe('department');
    expect(nav.current.params).toEqual({ dept: 'service' });

    nav.back();
    expect(nav.current.route).toBe('game');
  });

  it('reset replaces the whole stack so back cannot resurrect prior screens', () => {
    const nav = createNavigator('loading');
    nav.reset('character-creation');
    nav.reset('game');
    expect(nav.current.route).toBe('game');
    expect(nav.canGoBack).toBe(false);

    // back() from a reset root is inert — no loading/character-creation revival.
    nav.back();
    expect(nav.current.route).toBe('game');

    // Modals still push/pop on top of a reset root and return to it.
    nav.navigate('auction');
    expect(nav.canGoBack).toBe(true);
    nav.back();
    expect(nav.current.route).toBe('game');
    expect(nav.canGoBack).toBe(false);
  });

  it('keeps the current entry reference stable until it changes', () => {
    const nav = createNavigator('game');
    const before = nav.current;
    expect(nav.current).toBe(before);

    nav.navigate('auction');
    expect(nav.current).not.toBe(before);

    nav.back();
    expect(nav.current).toBe(before);
  });

  it('notifies subscribers on stack changes and stops after unsubscribe', () => {
    const nav = createNavigator('game');
    let calls = 0;
    const unsub = nav.subscribe(() => {
      calls++;
    });

    nav.navigate('auction');
    nav.back();
    expect(calls).toBe(2);

    unsub();
    nav.navigate('personnel');
    expect(calls).toBe(2);
  });
});
