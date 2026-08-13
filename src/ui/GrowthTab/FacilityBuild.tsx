import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Surface, Button, ProgressBar, Pill, HintLine } from '../kit';
import type { FacilityBuildModel, FacilityBuildRow } from './facilityBuildModel';
import type { FacilityCapacityKind } from '../../game/Facility';

export interface FacilityBuildProps {
  model: FacilityBuildModel;
  /** Commit the next block for this kind. Absent ⇒ read-only. */
  onBuild?: (kind: FacilityCapacityKind) => void;
  /** What committing to a build costs and buys (#388), null once used. */
  hint?: string | null;
}

/**
 * The Growth tab's **facility build** surface (#359, A2 R1).
 *
 * Growth is "work ON the business — everything that compounds across months"
 * (locked charter, `second-level-ia.md` §1). Buying buildings compounds, and
 * spends the same cash inventory wants, so it lives here rather than being a
 * room you walk into on the Operations side.
 *
 * Each capacity kind gets what it is standing at, what the tier allows, the
 * standing price, and one button. Anything under construction is listed with
 * the day it opens — the money has already left, so the wait is the only thing
 * left to read.
 *
 * Presentation only; every value arrives formatted from `buildFacilityBuild`.
 */
export function FacilityBuild({ model, onBuild, hint }: FacilityBuildProps) {
  const t = useTheme();
  return (
    <View testID="growth-facility-build">
      <Surface>
        {model.rows.map((row, i) => (
          <View key={row.kind} style={i === 0 ? undefined : { marginTop: t.spacing.lg }}>
            <BuildRow row={row} onBuild={onBuild} />
          </View>
        ))}
        {hint && <HintLine id="facility_build" text={hint} />}
      </Surface>
    </View>
  );
}

function BuildRow({
  row,
  onBuild,
}: {
  row: FacilityBuildRow;
  onBuild?: (kind: FacilityCapacityKind) => void;
}) {
  const t = useTheme();
  return (
    <View testID={`facility-build-row-${row.kind}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ ...t.typography.label, color: t.colors.textPrimary }}>{row.label}</Text>
        <Text
          testID={`facility-build-built-${row.kind}`}
          style={{
            ...t.typography.caption,
            color: t.colors.textSecondary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {row.builtLabel}
        </Text>
      </View>

      <View style={{ marginTop: t.spacing.xs }}>
        <ProgressBar
          value={row.fill}
          tone="primary"
          fillTestID={`facility-build-fill-${row.kind}`}
        />
      </View>

      <Text
        testID={`facility-build-price-${row.kind}`}
        style={{
          ...t.typography.caption,
          color: t.colors.textMuted,
          marginTop: t.spacing.xs,
        }}
      >
        {row.priceLabel}
      </Text>

      {row.jobLabels.length > 0 ? (
        <View style={{ marginTop: t.spacing.sm, gap: t.spacing.xs }}>
          {row.jobLabels.map((job) => (
            <View key={job.id} testID={`facility-build-job-${job.id}`}>
              <Pill tone="info" variant="soft" textCase="sentence" label={job.text} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: t.spacing.sm }}>
        <Button
          label={row.actionLabel}
          variant="secondary"
          disabled={row.disabled}
          onPress={row.disabled ? undefined : () => onBuild?.(row.kind)}
          testID={`facility-build-${row.kind}`}
        />
      </View>
    </View>
  );
}
