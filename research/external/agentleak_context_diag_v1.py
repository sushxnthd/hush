#!/usr/bin/env python3
"""Development diagnostics for AgentLeak context-boundary v1.

Reports which task-allowed target fields the current selector misses. Scorer-only
allowed_set labels are used strictly for diagnostics after selection; they never enter
selection itself. Intended only for the deterministic dev partition.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentleak_context_boundary_v1 as ev


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dataset', type=Path, required=True)
    ap.add_argument('--output', type=Path, default=Path('agentleak-context-diag-v1.json'))
    args = ap.parse_args()

    scenarios = ev.load_jsonl(args.dataset, 'dev')
    cfg = next(c for c in ev.CONFIGS if c['id'] == 'f8_t040_r070')
    present = Counter()
    retained = Counter()
    blocked = Counter()
    by_vertical = defaultdict(lambda: {'present':0,'retained':0,'scenarios':0})
    examples = defaultdict(list)

    for scenario in scenarios:
        selected = ev.select_fields(scenario, cfg)
        selected_keys = {(c.record_index, ev.field_key(c.field)) for c in selected}
        target_fields = [c for c in ev.flatten(scenario) if c.record_index == 0]
        allowed = [str(x) for x in (scenario.get('allowed_set') or {}).get('fields', [])]
        vertical = str(scenario.get('vertical') or 'unknown')
        by_vertical[vertical]['scenarios'] += 1
        instruction = ev.privacy_text(scenario)
        query = ev.objective_text(scenario)

        for candidate in target_fields:
            labels = [label for label in allowed if ev.matches_label(candidate.field, label)]
            if not labels:
                continue
            key = ev.field_key(candidate.field)
            present[key] += 1
            by_vertical[vertical]['present'] += 1
            if (candidate.record_index, key) in selected_keys:
                retained[key] += 1
                by_vertical[vertical]['retained'] += 1
            else:
                if ev.explicit_privacy_block(candidate.field, instruction):
                    blocked[key] += 1
                if len(examples[key]) < 5:
                    examples[key].append({
                        'scenario_id': scenario.get('scenario_id'),
                        'vertical': vertical,
                        'field': candidate.field,
                        'allowed_labels': labels,
                        'request': (scenario.get('objective') or {}).get('user_request'),
                        'success_criteria': (scenario.get('objective') or {}).get('success_criteria'),
                        'privacy_instruction': instruction,
                        'task_bonus': ev.task_bonus(candidate.field, query),
                        'risk': ev.risk(candidate.field),
                    })

    fields = []
    for key, n in present.most_common():
        r = retained[key]
        fields.append({
            'field': key,
            'present': n,
            'retained': r,
            'missed': n-r,
            'retention': r/n,
            'explicitly_blocked_misses': blocked[key],
            'examples': examples[key],
        })

    verticals = {}
    for key, row in sorted(by_vertical.items()):
        verticals[key] = {**row, 'retention': row['retained']/row['present'] if row['present'] else None}

    result = {'config':cfg,'scenarios':len(scenarios),'fields':fields,'verticals':verticals}
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True)+'\n', encoding='utf-8')
    print('Allowed-field diagnostic (top misses):')
    for row in sorted(fields, key=lambda x:(-x['missed'], x['field']))[:30]:
        print(f"{row['field']:24s} present={row['present']:4d} retained={row['retained']:4d} retention={row['retention']:.3f} blocked_misses={row['explicitly_blocked_misses']}")
    print('By vertical:')
    for key,row in verticals.items():
        val='n/a' if row['retention'] is None else f"{row['retention']:.3f}"
        print(f"{key:16s} retention={val} present={row['present']} retained={row['retained']}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
