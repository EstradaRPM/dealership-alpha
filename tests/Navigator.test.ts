import { createNavigator } from '../src/ui/Navigator';

describe('Navigator', () => {
  it('starts at the initial route with no params', () => {
    const nav = createNavigator('loading');
    expect(nav.current).toEqual({ route: 'loading', params: undefined });
    expect(nav.canGoBack).toBe(false);
  });

  it('navigate pushes a new screen and back pops it', () => {
    const nav = createNavigator('game');
    nav.navigate('in-game-menu');
    expect(nav.current.route).toBe('in-game-menu');
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

  it('reaches every root screen and unwinds the stack via back', () => {
    const nav = createNavigator('loading');
    nav.navigate('character-creation');
    nav.navigate('game');
    nav.navigate('settings');
    expect(nav.current.route).toBe('settings');
    nav.back();
    expect(nav.current.route).toBe('game');
    nav.navigate('kpi-dashboard');
    expect(nav.current.route).toBe('kpi-dashboard');

    nav.back();
    expect(nav.current.route).toBe('game');
    nav.navigate('history');
    expect(nav.current.route).toBe('history');
    nav.back();
    expect(nav.current.route).toBe('game');
  });

  // #348: the sub-screens are NOT root routes any more. They live on the tab
  // stacks (TabStacks.test.ts), because pushing them here is exactly what
  // unmounted the 5-tab shell.
  it('will not accept a tab route on the root stack', () => {
    const nav = createNavigator('game');

    // @ts-expect-error — 'lot' is a TAB route; the compiler is the guard that
    // keeps a room from ever replacing the shell again.
    nav.navigate('lot');
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
    nav.navigate('in-game-menu');
    expect(nav.canGoBack).toBe(true);
    nav.back();
    expect(nav.current.route).toBe('game');
    expect(nav.canGoBack).toBe(false);
  });

  it('keeps the current entry reference stable until it changes', () => {
    const nav = createNavigator('game');
    const before = nav.current;
    expect(nav.current).toBe(before);

    nav.navigate('in-game-menu');
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

    nav.navigate('in-game-menu');
    nav.back();
    expect(calls).toBe(2);

    unsub();
    nav.navigate('settings');
    expect(calls).toBe(2);
  });
});
