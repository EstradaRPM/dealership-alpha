import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { DepartmentScreen } from '../src/ui/DepartmentScreen';
import type { QueueItem } from '../src/game/DepartmentQueue';
import { emptyState } from '../src/ui/copy';

const items: QueueItem[] = [
  { id: 'q-1', type: 'routine', dept: 'office', label: 'Receptionist phone question', createdDay: 1 },
  { id: 'q-2', type: 'routine', dept: 'office', label: 'Title paperwork', createdDay: 1 },
];

describe('DepartmentScreen smoke tests', () => {
  it('renders a populated queue without crashing', () => {
    expect(() =>
      render(
        <DepartmentScreen
          title="Office"
          items={items}
          onResolve={() => {}}
          onClose={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it('renders an empty queue as an empty-state, not a crash', () => {
    const { getByText } = render(
      <DepartmentScreen
        title="Lot"
        items={[]}
        onResolve={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText(emptyState('department_queue', { queue: 'Lot' }))).toBeTruthy();
  });

  it('tapping a row resolves that item by id', () => {
    const onResolve = jest.fn();
    const { getByText } = render(
      <DepartmentScreen
        title="Office"
        items={items}
        onResolve={onResolve}
        onClose={() => {}}
      />,
    );
    fireEvent.press(getByText('Title paperwork'));
    expect(onResolve).toHaveBeenCalledWith('q-2');
  });

  it('Back invokes onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <DepartmentScreen
        title="Office"
        items={items}
        onResolve={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.press(getByText('‹ Back'));
    expect(onClose).toHaveBeenCalled();
  });

  it('honors the renderItem / background slots', () => {
    const { getByText } = render(
      <DepartmentScreen
        title="Service"
        items={items}
        onResolve={() => {}}
        onClose={() => {}}
        background={<Text>BACKDROP</Text>}
        renderItem={(item) => <Text>custom:{item.label}</Text>}
      />,
    );
    expect(getByText('BACKDROP')).toBeTruthy();
    expect(getByText('custom:Title paperwork')).toBeTruthy();
  });
});
