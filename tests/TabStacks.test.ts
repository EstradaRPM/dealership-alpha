import { createTabStacks } from '../src/ui/Navigator';

// #348 — locked IA §3: "sub-screens render inside the shell — the tab bar stays
// visible and each tab owns a navigation stack; switching tabs preserves
// position within each." This is the isolation test of that machine; the live
// drive through the real shell is InTabNavigation.reachability.test.tsx.

type Tab = 'home' | 'operations' | 'people';

describe('TabStacks — one stack per tab', () => {
  it('starts on the initial tab with every stack at its root', () => {
    const tabs = createTabStacks<Tab>('home');

    expect(tabs.activeTab).toBe('home');
    expect(tabs.current).toBeUndefined();
    expect(tabs.canGoBack).toBe(false);
  });

  it('pushes onto the ACTIVE tab and pops back to its root', () => {
    const tabs = createTabStacks<Tab>('home');
    tabs.setActiveTab('operations');

    tabs.navigate('lot');
    expect(tabs.current?.route).toBe('lot');
    expect(tabs.canGoBack).toBe(true);

    tabs.back();
    expect(tabs.current).toBeUndefined();
    expect(tabs.canGoBack).toBe(false);
  });

  it('carries route params through the stack', () => {
    const tabs = createTabStacks<Tab>('operations');

    tabs.navigate('department', { dept: 'bdc' });
    expect(tabs.current).toEqual({ route: 'department', params: { dept: 'bdc' } });
  });

  it('stacks deeper than one — the Lot room, then a unit inside it', () => {
    const tabs = createTabStacks<Tab>('operations');

    tabs.navigate('lot');
    tabs.navigate('pricing', { vehicleId: 'v1' });
    expect(tabs.current?.route).toBe('pricing');

    // Back lands in the room it was opened from, not at the tab's root.
    tabs.back();
    expect(tabs.current?.route).toBe('lot');
    tabs.back();
    expect(tabs.current).toBeUndefined();
  });

  it('preserves each tab position across a switch away and back', () => {
    const tabs = createTabStacks<Tab>('operations');
    tabs.navigate('lot');
    tabs.navigate('auction');

    // People is at its own root — Operations' depth does not leak into it.
    tabs.setActiveTab('people');
    expect(tabs.current).toBeUndefined();
    expect(tabs.canGoBack).toBe(false);

    // ...and coming back restores Operations exactly where it was left.
    tabs.setActiveTab('operations');
    expect(tabs.current?.route).toBe('auction');
    expect(tabs.canGoBack).toBe(true);
  });

  it('reads any tab position without switching to it', () => {
    const tabs = createTabStacks<Tab>('operations');
    tabs.navigate('service');
    tabs.setActiveTab('home');

    expect(tabs.topOf('operations')?.route).toBe('service');
    expect(tabs.topOf('home')).toBeUndefined();
    expect(tabs.activeTab).toBe('home');
  });

  it('back at a tab root is a no-op', () => {
    const tabs = createTabStacks<Tab>('home');
    tabs.back();
    expect(tabs.current).toBeUndefined();
    expect(tabs.activeTab).toBe('home');
  });

  it('reset clears every stack and returns to the initial tab', () => {
    const tabs = createTabStacks<Tab>('home');
    tabs.setActiveTab('operations');
    tabs.navigate('lot');

    tabs.reset();
    expect(tabs.activeTab).toBe('home');
    expect(tabs.current).toBeUndefined();
    expect(tabs.topOf('operations')).toBeUndefined();
  });

  it('notifies subscribers on tab switches AND pushes, and stops after unsubscribe', () => {
    const tabs = createTabStacks<Tab>('home');
    let calls = 0;
    const unsub = tabs.subscribe(() => {
      calls++;
    });

    tabs.setActiveTab('operations');
    tabs.navigate('lot');
    tabs.back();
    expect(calls).toBe(3);

    // A switch to the tab already active changes nothing, so it emits nothing.
    tabs.setActiveTab('operations');
    expect(calls).toBe(3);

    unsub();
    tabs.navigate('lot');
    expect(calls).toBe(3);
  });

  it('advances the version on every change — the React snapshot', () => {
    const tabs = createTabStacks<Tab>('home');
    const start = tabs.version;

    tabs.setActiveTab('operations');
    expect(tabs.version).toBeGreaterThan(start);
    const afterSwitch = tabs.version;

    // Two rooted tabs both read `current === undefined`; only the version tells
    // the renderer that anything happened.
    tabs.setActiveTab('people');
    expect(tabs.current).toBeUndefined();
    expect(tabs.version).toBeGreaterThan(afterSwitch);
  });
});
