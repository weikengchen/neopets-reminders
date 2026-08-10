# Parser Specification

## 1. General parser contract

Parsers are pure functions. They do not know about Chrome APIs.

```ts
parseX(documentLike, observedAt): Observation[]
```

They may:

- read text/attributes from the supplied DOM;
- normalize whitespace;
- parse human-readable durations;
- return structured observations.

They may not:

- navigate;
- fetch;
- mutate gameplay DOM;
- create alarms;
- store data.

## 2. Duration parsing

Training precedent currently contains text forms equivalent to:

```text
X hrs, Y minutes, Z seconds
```

Support singular/plural variants defensively:

```text
1 hr, 1 minute, 1 second
2 hrs, 5 minutes, 9 seconds
```

Return milliseconds or `null`. Never silently treat an unparseable string as zero.

## 3. Training school detection

Derive school from the current allowlisted URL, not arbitrary page text:

```text
pirates/academy.phtml?type=status          → pirate
island/training.phtml?type=status          → mystery
island/fight_training.phtml?type=status    → ninja
```

The approved Training Timer currently uses these same three status URLs.

## 4. Training observation model

```ts
interface TrainingObservation {
  kind: 'training';
  petName: string;
  school: 'pirate' | 'mystery' | 'ninja';
  observedAt: number;
  dueAt: number;
  state: 'training' | 'ready';
}
```

`dueAt` for ready may equal `observedAt`.

## 5. Parser versioning

Every reminder record stores `parserVersion`.

Why:

- Neopets markup changes.
- Old stored reminders should remain understandable.
- If a parser bug is discovered, a migration can invalidate only affected observations.

## 6. Staleness

A timer can safely become ready based on local time, but other aspects of remote state can become stale.

Examples:

- The player may have completed training in another browser/device.
- The pet may have changed accounts/ownership.
- The page semantics may change.

Therefore the popup should distinguish:

- **Ready based on saved timer**
- **Last observed at <time>**

Do not imply that remote Neopets state has been rechecked.

## 7. Error handling

If a supported page no longer matches fixtures:

- emit no new reminder for ambiguous rows;
- retain existing stored reminder rather than replacing it with fabricated data;
- optionally show a local diagnostic such as “Could not read current timer”; 
- record no page HTML remotely.

## 8. Fixture policy

Fixtures should be:

- manually captured;
- stripped of unrelated account information;
- committed locally/repository if safe;
- small enough to review;
- accompanied by a note containing capture date and page type.

Do not implement a scheduled fixture updater that visits Neopets automatically.
