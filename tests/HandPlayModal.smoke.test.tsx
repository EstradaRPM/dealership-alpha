import React from 'react';
import { render } from '@testing-library/react-native';
import { HandPlayModal } from '../src/ui/HandPlayModal';

describe('HandPlayModal smoke tests', () => {
  it('renders closed (not visible) without crashing', () => {
    expect(() =>
      render(
        <HandPlayModal
          visible={false}
          customerId={null}
          playLive={false}
          outcome={null}
          onChoose={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('renders a pending gate with approach choices without crashing', () => {
    expect(() =>
      render(
        <HandPlayModal
          visible
          customerId="floor:1:12:0"
          playLive={false}
          outcome={{
            status: 'continue',
            gate: 'MEET_GREET',
            choices: [
              { id: 'rapport', label: 'Build rapport' },
              { id: 'direct', label: 'Direct pitch' },
            ],
          }}
          onChoose={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('renders the terminal closed and walk outcomes without crashing', () => {
    expect(() =>
      render(
        <HandPlayModal
          visible
          customerId="floor:1:12:0"
          playLive
          outcome={{ status: 'closed' }}
          onChoose={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    ).not.toThrow();
    expect(() =>
      render(
        <HandPlayModal
          visible
          customerId="floor:1:12:0"
          playLive={false}
          outcome={{ status: 'walk', cause: 'low_quality' }}
          onChoose={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
