/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { AuditEvent } from '../types';

/**
 * Immutable in-memory audit store demonstrating append-only audit trail discipline.
 * Audit records can never be rewritten or deleted.
 */
export class AuditTrail {
  private readonly events: AuditEvent[] = [];
  private readonly seenActionIds = new Set<string>();

  /**
   * Appends an audit event to the trail.
   * If an event with the exact same ID is submitted again, it is treated as an idempotent retry.
   * If an event with the same ID has different content, throws an error.
   */
  public append(event: AuditEvent): void {
    const existing = this.events.find((e) => e.id === event.id);
    if (existing) {
      // Idempotent retry check
      if (
        existing.eventType === event.eventType &&
        existing.caseId === event.caseId &&
        existing.decisionId === event.decisionId &&
        existing.actorEntityId === event.actorEntityId &&
        existing.description === event.description &&
        existing.createdAt === event.createdAt
      ) {
        return; // Idempotent no-op
      }
      throw new Error(`Audit collision: event ID '${event.id}' already exists with different contents`);
    }

    this.events.push(Object.freeze({ ...event, evidenceIds: [...event.evidenceIds] }));
  }

  /**
   * Returns all audit events causally observed at or before cutoffTime T,
   * sorted canonically by createdAt ascending, then id ascending.
   */
  public getEvents(cutoffTime?: string): readonly AuditEvent[] {
    const cutoffTimestamp = cutoffTime ? Date.parse(cutoffTime) : Number.POSITIVE_INFINITY;
    return this.events
      .filter((e) => Date.parse(e.createdAt) <= cutoffTimestamp)
      .sort((a, b) => {
        const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
  }

  /**
   * Returns audit events filtered by caseId.
   */
  public getEventsForCase(caseId: string, cutoffTime?: string): readonly AuditEvent[] {
    return this.getEvents(cutoffTime).filter((e) => e.caseId === caseId);
  }
}
