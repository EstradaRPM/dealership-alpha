import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, Button, HintLine } from '../kit';
import { ChipRow } from '../DeptControls';
import type { CreditFacilityPanelModel } from './creditFacilityModel';

export interface CreditFacilityPanelProps {
  model: CreditFacilityPanelModel;
  /**
   * Commit the draw. Returns the reason it was refused, or `null` when the
   * money moved.
   *
   * A returned notice rather than a void handler because **a refusal changes
   * nothing at all** (#392): there is no state change for the panel to observe
   * and re-read, so the one thing that happened is the sentence. Absent ⇒
   * read-only, the `FacilityBuild` idiom.
   */
  onDraw?: (amount: number) => string | null;
  /** Commit the repayment. Same contract as `onDraw`. */
  onRepay?: (amount: number) => string | null;
  /** What borrowing costs the store (#388), null once the control is used. */
  hint?: string | null;
}

/**
 * The Finance room's **credit facility** (#393) — the surface half of #392.
 *
 * The one place in the room that is a lever rather than a reading, and it earns
 * the exception the same way the money does: the facility's whole cost model is
 * a line on the statement, so the control that creates that line belongs beside
 * it rather than in a room the player would have to remember to visit.
 *
 * The selected amount is **view state and nothing else** — it commits the store
 * to nothing until Borrow or Pay Back is pressed, so it lives here rather than
 * being lifted into the container the way a persisted lever would be.
 *
 * Presentation only; every value arrives formatted from
 * `buildCreditFacilityPanel`.
 */
export function CreditFacilityPanel({
  model,
  onDraw,
  onRepay,
  hint,
}: CreditFacilityPanelProps) {
  const t = useTheme();
  const [selectedId, setSelectedId] = useState<string>(
    model.amounts[0]?.id ?? '',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const selected = model.amounts.find((a) => a.id === selectedId);

  const caption = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };

  const commit = (act?: (amount: number) => string | null) => {
    if (!selected || !act) return;
    setNotice(act(selected.amount));
  };

  return (
    <Surface>
      <SectionHeader title={model.title} />
      <Text style={caption}>{model.caption}</Text>

      <View style={{ marginTop: t.spacing.md }}>
        <Figure label={model.limitLabel} value={model.limitValue} id="limit" />
        <Figure label={model.drawnLabel} value={model.drawnValue} id="drawn" />
        <Figure
          label={model.availableLabel}
          value={model.availableValue}
          id="available"
        />
        <Figure
          label={model.nextChargeLabel}
          value={model.nextChargeValue}
          id="next-charge"
        />
        <Figure
          label={model.interestLabel}
          value={model.interestValue}
          id="interest-paid"
        />
      </View>

      {/* One declared control group (#388): the amount chips and the two
          buttons are one decision — how much of the line to carry — so they
          share a lesson and retire it together. */}
      <View style={{ marginTop: t.spacing.lg }} testID="finance-credit-controls">
        <Text style={{ ...t.typography.label, color: t.colors.textSecondary }}>
          {model.amountsLabel}
        </Text>
        <View style={{ marginTop: t.spacing.xs }}>
          <ChipRow
            options={model.amounts.map((a) => ({ id: a.id, label: a.label }))}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              // The old refusal was about the old amount. Leaving it up would
              // have the panel arguing with a press the player has moved on
              // from.
              setNotice(null);
            }}
            testID="finance-credit-controls-amount"
          />
        </View>
        <View style={{ marginTop: t.spacing.sm, gap: t.spacing.sm }}>
          <Button
            label={model.drawLabel}
            variant="secondary"
            onPress={() => commit(onDraw)}
            testID="finance-credit-controls-draw"
          />
          <Button
            label={model.repayLabel}
            variant="secondary"
            onPress={() => commit(onRepay)}
            testID="finance-credit-controls-repay"
          />
        </View>
        {notice ? (
          <Text
            testID="finance-credit-notice"
            style={{
              ...t.typography.caption,
              color: t.colors.danger,
              marginTop: t.spacing.sm,
            }}
          >
            {notice}
          </Text>
        ) : null}
        {hint && <HintLine id="credit_line" text={hint} />}
      </View>
    </Surface>
  );
}

/** One label/figure pair, the statement row's grammar without its ladder. */
function Figure({
  label,
  value,
  id,
}: {
  label: string;
  value: string;
  id: string;
}) {
  const t = useTheme();
  return (
    <View
      testID={`finance-credit-${id}`}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingVertical: t.spacing.xs,
      }}
    >
      <Text style={{ ...t.typography.body, color: t.colors.textSecondary, flexShrink: 1 }}>
        {label}
      </Text>
      <Text style={{ ...t.typography.bodyStrong, color: t.colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}
