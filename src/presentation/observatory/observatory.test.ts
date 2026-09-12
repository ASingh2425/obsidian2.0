import { describe, expect, it } from 'vitest';
import {
  getSignalsForLens,
  TIMESTAMPS,
  DEFAULT_SCANNER_INDEX,
  SHIFT_REGION,
  CONTEXT_SPAN,
  CONTEXT_WINDOW,
  PRIMARY_ACTOR,
} from './observatoryData';

describe('Behavioral Observatory Prototype (Checkpoint 1)', () => {
  it('Primary Actor has non-accusatory pseudonymized identity', () => {
    expect(PRIMARY_ACTOR.id).toBe('ACTOR-SEC-0941');
    expect(PRIMARY_ACTOR.role).toBe('Systems Engineer');
    expect(PRIMARY_ACTOR.department).toBeDefined();
  });

  it('Temporal timeline has 25 discrete windows flowing left-to-right from 09:00 to 12:00 UTC', () => {
    expect(TIMESTAMPS.length).toBe(25);
    expect(TIMESTAMPS[0].label).toBe('09:00');
    expect(TIMESTAMPS[TIMESTAMPS.length - 1].label).toBe('12:00');

    // Default scanner is at 10:30 UTC (index 12)
    expect(DEFAULT_SCANNER_INDEX).toBe(12);
    expect(TIMESTAMPS[DEFAULT_SCANNER_INDEX].label).toBe('10:30');
  });

  it('Generates three primary behavioral signals (Auth, Resource, Privilege)', () => {
    const signals = getSignalsForLens('PERSONAL');
    expect(signals.length).toBeGreaterThanOrEqual(3);

    const auth = signals.find((s) => s.id === 'AUTH');
    const resource = signals.find((s) => s.id === 'RESOURCE');
    const privilege = signals.find((s) => s.id === 'PRIVILEGE');

    expect(auth).toBeDefined();
    expect(resource).toBeDefined();
    expect(privilege).toBeDefined();

    // Check behavioral signal traits specified in prompt
    // 1. Authentication: mostly stable with mild change
    expect(auth!.nominalPattern).toContain('SSO');
    const authAt1030 = auth!.points[DEFAULT_SCANNER_INDEX];
    expect(authAt1030.observedValue).toBeLessThanOrEqual(10);

    // 2. Resource Access: strong gradual drift
    const resAtStart = resource!.points[0].observedValue;
    const resAt1030 = resource!.points[DEFAULT_SCANNER_INDEX].observedValue;
    expect(resAt1030).toBeGreaterThan(resAtStart);
    expect(resAt1030).toBe(46); // Specification value at 10:30 UTC
    expect(resAt1030).toBeGreaterThan(resource!.points[DEFAULT_SCANNER_INDEX].upperThreshold);

    // 3. Privilege Activity: sudden step transition
    const privAtStart = privilege!.points[0].observedValue;
    const privAt1030 = privilege!.points[DEFAULT_SCANNER_INDEX].observedValue;
    expect(privAtStart).toBe(0);
    expect(privAt1030).toBe(12);
    expect(privAt1030).toBeGreaterThan(privilege!.points[DEFAULT_SCANNER_INDEX].upperThreshold);
  });

  it('Shift region encompasses the multi-dimensional behavioral departure', () => {
    expect(SHIFT_REGION.startIndex).toBe(8); // 10:00 UTC
    expect(SHIFT_REGION.endIndex).toBe(14);  // 10:38 UTC
    expect(SHIFT_REGION.startTimeLabel).toBe('10:00 UTC');
    expect(SHIFT_REGION.endTimeLabel).toBe('10:38 UTC');
    expect(SHIFT_REGION.label).toBe('BEHAVIORAL SHIFT HORIZON');
  });

  it('Context region accurately covers its valid temporal duration', () => {
    expect(CONTEXT_SPAN.startIndex).toBe(8); // 10:00 UTC
    expect(CONTEXT_SPAN.endIndex).toBe(18); // 11:15 UTC
    expect(CONTEXT_WINDOW.category).toBe('MAINTENANCE_WINDOW');
    expect(CONTEXT_WINDOW.approvalRef).toBe('CHG-TKT-8842-APPR');
  });

  it('Changing lens adjusts baseline median without modifying observed behavioral signal', () => {
    const personal = getSignalsForLens('PERSONAL');
    const peer = getSignalsForLens('PEER');

    const personalRes = personal.find((s) => s.id === 'RESOURCE')!;
    const peerRes = peer.find((s) => s.id === 'RESOURCE')!;

    // Observed values are identical
    expect(personalRes.points[DEFAULT_SCANNER_INDEX].observedValue).toBe(
      peerRes.points[DEFAULT_SCANNER_INDEX].observedValue,
    );

    // Reference median is transformed
    expect(personalRes.points[DEFAULT_SCANNER_INDEX].medianValue).not.toBe(
      peerRes.points[DEFAULT_SCANNER_INDEX].medianValue,
    );
  });
});
