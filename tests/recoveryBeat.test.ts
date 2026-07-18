import {
  buildRecoveryBeat,
  buildRecoveryBanners,
  type RecoveryEventKind,
} from '../src/ui/NarrativeBeat';

describe('#326 buildRecoveryBeat — narrative beat copy', () => {
  const kinds: RecoveryEventKind[] = [
    'bankruptcy_contraction',
    'indictment_contraction',
    'ag_complaint_contraction',
    'ag_complaint_consent_decree',
  ];

  it('produces a full cause / cost / path beat for every recovery event', () => {
    for (const kind of kinds) {
      const beat = buildRecoveryBeat({ kind, fromTier: 2, tier: 3 });
      expect(beat.kind).toBe(kind);
      expect(beat.title.length).toBeGreaterThan(0);
      expect(beat.cause.length).toBeGreaterThan(0);
      expect(beat.cost.length).toBeGreaterThan(0);
      expect(beat.path.length).toBeGreaterThan(0);
    }
  });

  it('gives each event a distinct headline (four unique beats)', () => {
    const titles = new Set(kinds.map((kind) => buildRecoveryBeat({ kind }).title));
    expect(titles.size).toBe(4);
  });

  it('names the debt overhang in the bankruptcy contraction cost, grouped', () => {
    const beat = buildRecoveryBeat({
      kind: 'bankruptcy_contraction',
      fromTier: 2,
      debtPrincipal: 50000,
    });
    expect(beat.cost).toContain('$50,000');
    // Dropped a tier: T2 → T1.
    expect(beat.cost).toContain('Tier 1');
  });

  it('names the forfeited stake + tier drop for the indictment contraction', () => {
    const beat = buildRecoveryBeat({
      kind: 'indictment_contraction',
      fromTier: 2,
      stakePenalty: 100000,
    });
    expect(beat.cost).toContain('$100,000');
    expect(beat.cost).toContain('Tier 1');
  });

  it('names the suspension window (pluralized) for the AG contraction', () => {
    const beat = buildRecoveryBeat({
      kind: 'ag_complaint_contraction',
      fromTier: 2,
      suspensionDays: 14,
    });
    expect(beat.cost).toContain('14 days');
    expect(beat.cost).toContain('Tier 1');
  });

  it('names cash + reputation cost and preserves the tier for the consent decree', () => {
    const beat = buildRecoveryBeat({
      kind: 'ag_complaint_consent_decree',
      tier: 3,
      cashCost: 75000,
      reputationHit: -25,
    });
    expect(beat.cost).toContain('$75,000');
    expect(beat.cost).toContain('25-point');
    // Tier preserved, not dropped.
    expect(beat.cost).toContain('Tier 3');
    expect(beat.path).toMatch(/tier is intact/i);
  });

  it('singularizes a one-day suspension', () => {
    const beat = buildRecoveryBeat({
      kind: 'ag_complaint_contraction',
      fromTier: 2,
      suspensionDays: 1,
    });
    expect(beat.cost).toContain('1 day');
    expect(beat.cost).not.toContain('1 days');
  });

  it('never floors a tier drop below 1', () => {
    const beat = buildRecoveryBeat({
      kind: 'bankruptcy_contraction',
      fromTier: 1,
      debtPrincipal: 10000,
    });
    expect(beat.cost).not.toContain('Tier 0');
  });
});

describe('#326 buildRecoveryBanners — persistent banner derives from monitor state', () => {
  it('shows nothing when no recovery state is active', () => {
    const banners = buildRecoveryBanners({
      outstandingDebt: 0,
      isSuspended: false,
      suspensionDaysRemaining: 0,
    });
    expect(banners).toEqual([]);
  });

  it('raises a debt-overhang banner while debt remains, with grouped money', () => {
    const banners = buildRecoveryBanners({
      outstandingDebt: 48000,
      isSuspended: false,
      suspensionDaysRemaining: 0,
    });
    expect(banners).toHaveLength(1);
    expect(banners[0].kind).toBe('debt-overhang');
    expect(banners[0].detail).toContain('$48,000');
  });

  it('raises a suspension banner with the days remaining', () => {
    const banners = buildRecoveryBanners({
      outstandingDebt: 0,
      isSuspended: true,
      suspensionDaysRemaining: 9,
    });
    expect(banners).toHaveLength(1);
    expect(banners[0].kind).toBe('license-suspension');
    expect(banners[0].detail).toContain('9 days');
  });

  it('shows both banners at once in a stable order (debt, then suspension)', () => {
    const banners = buildRecoveryBanners({
      outstandingDebt: 12000,
      isSuspended: true,
      suspensionDaysRemaining: 3,
    });
    expect(banners.map((b) => b.kind)).toEqual([
      'debt-overhang',
      'license-suspension',
    ]);
  });

  it('clears the debt banner the instant the overhang reaches 0 (self-resolving)', () => {
    const banners = buildRecoveryBanners({
      outstandingDebt: 0,
      isSuspended: false,
      suspensionDaysRemaining: 0,
    });
    expect(banners.some((b) => b.kind === 'debt-overhang')).toBe(false);
  });
});
