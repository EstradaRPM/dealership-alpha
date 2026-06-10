import React from 'react';
import {
  View,
  Text,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { SectionHeader } from '../kit';
import type { DeptKey } from '../../game/DepartmentQueue';
import { BottomNav } from '../BottomNav';
import { OwnershipLevers, type OwnershipLeversProps } from '../OwnershipLevers';

export interface OperationsTabProps {
  /** Department launch badges + dispatch (the day-to-day department dock). */
  badges: Record<DeptKey, number>;
  onDeptPress: (dept: DeptKey) => void;
  /** Pre-open ownership levers (#120). Absent ⇒ auction fallback / hint. */
  leverProps?: OwnershipLeversProps;
  /** Fallback when there are no levers yet. */
  onOpenAuction?: () => void;
}

/**
 * The tactical day-to-day surface (#215). Departments are reachable here (the
 * dock) and the pre-open prep levers — pricing, sourcing, hiring, hours, trade
 * policy, the T1 demand lever — live here, grouped under Operations per the
 * locked IA. Pure composition of existing read-model surfaces.
 */
export function OperationsTab({
  badges,
  onDeptPress,
  leverProps,
  onOpenAuction,
}: OperationsTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };
  const hint: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  };
  const secondaryBtn: ViewStyle = {
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primaryDim,
    alignSelf: 'flex-start',
  };
  const secondaryBtnText: TextStyle = {
    ...t.typography.button,
    color: t.colors.accent,
  };

  return (
    <View>
      <View style={region} testID="ops-region-departments">
        <SectionHeader title="Departments" />
        <View style={regionBody}>
          <BottomNav badges={badges} onPress={onDeptPress} />
        </View>
      </View>

      <View style={region} testID="ops-region-prep">
        <SectionHeader title="Prep" />
        <View style={regionBody}>
          {leverProps ? (
            <OwnershipLevers {...leverProps} />
          ) : onOpenAuction ? (
            <Pressable
              style={secondaryBtn}
              accessibilityRole="button"
              onPress={onOpenAuction}
            >
              <Text style={secondaryBtnText}>Visit Auction →</Text>
            </Pressable>
          ) : (
            <Text style={hint}>Prep levers will mount here as they unlock.</Text>
          )}
        </View>
      </View>
    </View>
  );
}
