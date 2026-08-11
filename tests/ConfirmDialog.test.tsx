import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ConfirmDialog, useConfirm, type ConfirmRequest } from '../src/ui/kit';
import { Button } from '../src/ui/kit';

/**
 * The confirmation surface (delete-a-save session, 2026-08-11).
 *
 * `Alert.alert` is a no-op on react-native-web — literally
 * `class Alert { static alert() {} }` in react-native-web's Alert export — so
 * every destructive confirmation in this app did nothing at all on the web
 * target the game is driven from. These cover the replacement and the guard
 * that stops a future surface from quietly re-introducing the dead call.
 */

function Harness({ request }: { request: ConfirmRequest }) {
  const { ask, dialog } = useConfirm();
  return (
    <>
      <Button label="Open" onPress={() => ask(request)} />
      {dialog}
    </>
  );
}

describe('ConfirmDialog', () => {
  it('renders nothing until something is asked', () => {
    const screen = render(<ConfirmDialog request={null} onDismiss={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('states the question and both answers', () => {
    const screen = render(
      <ConfirmDialog
        request={{ title: 'Delete Save', message: 'Gone for good.', confirmLabel: 'Delete' }}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText('Delete Save')).toBeTruthy();
    expect(screen.getByText('Gone for good.')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('runs onConfirm when the acting button is pressed', () => {
    const onConfirm = jest.fn();
    const onDismiss = jest.fn();
    const screen = render(
      <ConfirmDialog
        request={{ title: 'T', message: 'M', confirmLabel: 'Do It', onConfirm }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(screen.getByText('Do It'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Closed first, so an async handler never leaves the question on screen
    // looking unanswered while it runs.
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('never runs onConfirm when cancelled', () => {
    const onConfirm = jest.fn();
    const onDismiss = jest.fn();
    const screen = render(
      <ConfirmDialog
        request={{ title: 'T', message: 'M', onConfirm }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(screen.getByText('Cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('cancelLabel: null is the notice form — one button, nothing to decline', () => {
    const screen = render(
      <ConfirmDialog
        request={{ title: 'Dev fixture', message: 'Could not start.', confirmLabel: 'OK', cancelLabel: null }}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText('OK')).toBeTruthy();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('useConfirm opens on ask and closes on an answer', async () => {
    const onConfirm = jest.fn();
    const screen = render(
      <Harness request={{ title: 'Wipe It', message: 'Sure?', confirmLabel: 'Wipe', onConfirm }} />,
    );
    expect(screen.queryByText('Wipe It')).toBeNull();

    fireEvent.press(screen.getByText('Open'));
    await waitFor(() => expect(screen.getByText('Wipe It')).toBeTruthy());

    fireEvent.press(screen.getByText('Wipe'));
    await waitFor(() => expect(screen.queryByText('Wipe It')).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

/**
 * The guard. `Alert.alert` compiles, type-checks and runs everywhere — it just
 * does nothing on web — so nothing but a source scan catches its return.
 */
describe('no surface asks a question through the dead Alert API', () => {
  const SRC = path.join(__dirname, '..', 'src');

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const files = sourceFiles(SRC);

  it('finds the source tree (guard is actually scanning something)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)('%s does not call Alert.alert', (file) => {
    expect(fs.readFileSync(file, 'utf8')).not.toMatch(/\bAlert\s*\.\s*alert\s*\(/);
  });
});
