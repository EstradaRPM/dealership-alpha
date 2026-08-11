import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { GradientSurface } from './Gradient';

/**
 * What the dialog asks and what happens if the player says yes.
 *
 * `cancelLabel: null` is the notice form — one acknowledging button, no way to
 * decline — so a message the player only has to read does not need a second
 * dialog component beside this one.
 */
export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  /** The verb on the acting button. Default `Confirm`. */
  readonly confirmLabel?: string;
  /** The way out. `null` makes this a notice with nothing to decline. Default `Cancel`. */
  readonly cancelLabel?: string | null;
  /** `danger` paints the acting button destructive-red. Default `primary`. */
  readonly tone?: 'primary' | 'danger';
  /** Runs after the dialog closes. May be async; the caller owns its errors. */
  readonly onConfirm?: () => void | Promise<void>;
}

export interface ConfirmDialogProps {
  /** The pending question, or `null` when nothing is being asked. */
  readonly request: ConfirmRequest | null;
  /** Close without acting — the Cancel button and the backdrop both call this. */
  readonly onDismiss: () => void;
}

/**
 * The app's one confirmation surface.
 *
 * It exists because `Alert.alert` is a literal no-op on react-native-web
 * (`class Alert { static alert() {} }`), so every destructive confirmation in
 * this app — delete a save, roll a save back, wipe the playtest log — silently
 * did nothing on the web target the game is driven from. A dialog the player
 * cannot answer is a mechanic that is not there. Rendering our own `Modal`
 * means the same question is asked, and answerable, on every platform.
 *
 * Pure presentation: the caller owns what confirming does.
 */
export function ConfirmDialog({ request, onDismiss }: ConfirmDialogProps) {
  const t = useTheme();
  if (request === null) return null;

  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'primary',
    onConfirm,
  } = request;

  // Close first, then act: an async handler must never leave the question on
  // screen looking unanswered while it runs.
  const handleConfirm = () => {
    onDismiss();
    if (onConfirm) void onConfirm();
  };

  const backdrop: ViewStyle = {
    flex: 1,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xl,
  };
  const frame: ViewStyle = {
    width: '100%',
    maxWidth: 420,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.surfaceRaised,
    ...t.elevation.floating,
  };
  const sheet: ViewStyle = {
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    padding: t.spacing.xl,
    gap: t.spacing.md,
  };
  const titleText: TextStyle = { ...t.typography.sectionTitle, color: t.colors.textPrimary };
  const bodyText: TextStyle = { ...t.typography.body, color: t.colors.textSecondary };
  const actions: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      {/* Tapping outside the sheet is the same answer as Cancel — and on a
          notice it is the same answer as acknowledging, since there is nothing
          to decline. */}
      <Pressable style={backdrop} onPress={onDismiss}>
        {/* Swallows the backdrop press so a tap on the card itself never
            dismisses the question underneath it. */}
        <Pressable style={frame} onPress={() => {}}>
          <GradientSurface gradient="surfaceRaised" style={sheet}>
            <Text style={titleText}>{title}</Text>
            <Text style={bodyText}>{message}</Text>
            <View style={actions}>
              {cancelLabel === null ? null : (
                <Button label={cancelLabel} variant="ghost" onPress={onDismiss} />
              )}
              <Button
                label={confirmLabel}
                variant={tone === 'danger' ? 'danger' : 'primary'}
                onPress={handleConfirm}
              />
            </View>
          </GradientSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export interface Confirm {
  /** Put a question on screen. A second `ask` replaces the pending one. */
  readonly ask: (request: ConfirmRequest) => void;
  /** Render this once, anywhere in the calling surface's tree. */
  readonly dialog: React.ReactElement;
}

/**
 * Holds the "what is being asked right now" state so a surface needing a
 * confirmation is two lines (`const { ask, dialog } = useConfirm()`, then
 * `{dialog}`) rather than its own piece of modal state. One place owns the
 * pattern, so no surface can quietly re-invent it as a dead `Alert.alert`.
 */
export function useConfirm(): Confirm {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const ask = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const dismiss = useCallback(() => setRequest(null), []);
  return {
    ask,
    dialog: <ConfirmDialog request={request} onDismiss={dismiss} />,
  };
}
