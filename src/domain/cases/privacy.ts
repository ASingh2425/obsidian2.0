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

/**
 * Validates that an actor identifier complies with the pseudonymous ID policy (AT-PRIV-001).
 * Rejects email addresses, raw full names, and non-token identities.
 * Accepts canonical pseudonyms like USER-ALICE, USR-042, ANALYST-101, SVC-BACKUP, system.
 */
export const isValidPseudonymousId = (id: string): boolean => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Reject email addresses
  if (trimmed.includes('@') || trimmed.includes('.com') || trimmed.includes('.org')) {
    return false;
  }

  // Reject raw person names with whitespace (e.g. "Alice Smith")
  if (/\s+/.test(trimmed)) {
    return false;
  }

  // Permitted canonical pseudonymous tokens
  // System actors
  if (trimmed === 'system') {
    return true;
  }

  // Token pattern: alphanumeric with hyphens/underscores (e.g., USER-ALICE, USR-042, ANALYST-101)
  const pseudonymousPattern = /^[A-Za-z0-9_-]+$/;
  return pseudonymousPattern.test(trimmed);
};

/**
 * Asserts that an actor identifier is pseudonymous, throwing a descriptive error if not.
 */
export const assertPseudonymousId = (id: string, fieldName = 'actorEntityId'): void => {
  if (!isValidPseudonymousId(id)) {
    throw new Error(
      `Privacy violation: Field '${fieldName}' must be a valid pseudonymous identifier (AT-PRIV-001). Received: '${id}'`,
    );
  }
};
