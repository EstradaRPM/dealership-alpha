import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import type { EventBus, EventMap } from '../../game/EventBus';

const MAX_EVENTS = 20;
const SCROLL_SPEED_PX_PER_SEC = 80;
const SEPARATOR = '   ·   ';

export interface MarqueeEvent {
  id: string;
  text: string;
}

interface Props {
  eventBus?: EventBus;
  initialEvents?: MarqueeEvent[];
}

export function ActivityMarquee({ eventBus, initialEvents = [] }: Props) {
  const [events, setEvents] = useState<MarqueeEvent[]>(initialEvents);
  const translateX = useRef(new Animated.Value(0)).current;
  const textWidthRef = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const windowWidth = Dimensions.get('window').width;

  const addEvent = useRef((text: string) => {
    setEvents(prev => {
      const entry: MarqueeEvent = { id: `${Date.now()}-${Math.random()}`, text };
      const next = [...prev, entry];
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    });
  }).current;

  useEffect(() => {
    if (!eventBus) return;

    const onDealClosed = (p: EventMap['deal:closed']) =>
      addEvent(`Deal closed — $${(p.frontGross + p.backGross).toLocaleString()} gross`);

    const onResolved = (p: EventMap['customer:resolved']) => {
      if (p.outcome === 'walk') addEvent('Customer walked');
    };

    const onPoached = (p: EventMap['customer:poached']) =>
      addEvent(`${p.competitorName} poached a customer`);

    const onTierUp = (p: EventMap['career:tier_up']) =>
      addEvent(`Tier up — now Tier ${p.toTier}`);

    const onMissed = (_p: EventMap['capacity:missed_opportunity']) =>
      addEvent('Missed opportunity — lot at capacity');

    const onQuit = (_p: EventMap['staff:quit']) =>
      addEvent('Staff member quit');

    const onVehiclePurchased = (p: EventMap['inventory:vehicle_purchased']) =>
      addEvent(`New vehicle arrived — $${p.cost.toLocaleString()}`);

    const onAutoResolved = (p: EventMap['staff:auto_resolved']) => {
      if (p.outcome === 'closed')
        addEvent(`Staff closed a deal — $${p.grossImpact.toLocaleString()} gross`);
    };

    eventBus.subscribe('deal:closed', onDealClosed);
    eventBus.subscribe('customer:resolved', onResolved);
    eventBus.subscribe('customer:poached', onPoached);
    eventBus.subscribe('career:tier_up', onTierUp);
    eventBus.subscribe('capacity:missed_opportunity', onMissed);
    eventBus.subscribe('staff:quit', onQuit);
    eventBus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    eventBus.subscribe('staff:auto_resolved', onAutoResolved);

    return () => {
      eventBus.unsubscribe('deal:closed', onDealClosed);
      eventBus.unsubscribe('customer:resolved', onResolved);
      eventBus.unsubscribe('customer:poached', onPoached);
      eventBus.unsubscribe('career:tier_up', onTierUp);
      eventBus.unsubscribe('capacity:missed_opportunity', onMissed);
      eventBus.unsubscribe('staff:quit', onQuit);
      eventBus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      eventBus.unsubscribe('staff:auto_resolved', onAutoResolved);
    };
  }, [eventBus, addEvent]);

  const startScroll = () => {
    const textWidth = textWidthRef.current;
    if (textWidth === 0) return;
    animRef.current?.stop();
    translateX.setValue(windowWidth);
    const duration = ((windowWidth + textWidth) / SCROLL_SPEED_PX_PER_SEC) * 1000;
    animRef.current = Animated.timing(translateX, {
      toValue: -textWidth,
      duration,
      useNativeDriver: true,
    });
    animRef.current.start(({ finished }) => {
      if (finished) startScroll();
    });
  };

  useEffect(() => {
    startScroll();
    return () => { animRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const text = events.map(e => e.text).join(SEPARATOR);
  if (text === '') return null;

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[styles.text, { transform: [{ translateX }] }]}
        numberOfLines={1}
        onLayout={e => {
          textWidthRef.current = e.nativeEvent.layout.width;
          startScroll();
        }}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 28,
    overflow: 'hidden',
    backgroundColor: '#0d0d0d',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    color: '#666',
    letterSpacing: 0.3,
    fontStyle: 'italic',
    position: 'absolute',
  },
});
