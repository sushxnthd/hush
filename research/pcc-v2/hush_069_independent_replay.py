#!/usr/bin/env python3
"""Independent HUSH-069 event-order replay. No credentials or private results."""
import json
import sys
from pathlib import Path

EXPECTED = {
 "stale_race": (["enqueued","commit_checked","revoked","released","effect_committed"],1,False,0),
 "guarded_revoke_first": (["enqueued","commit_waiting","revoked","released","commit_denied"],0,True,1),
 "guarded_commit_first": (["enqueued","commit_waiting","released","effect_committed","revoked"],1,True,1),
 "guarded_crash_restart": (["enqueued","commit_waiting","revoked","commit_process_killed","restart_denied"],0,True,1),
 "orphan_lock": (["orphan_lock","revocation_denied","commit_denied"],0,False,0),
}
def replay(path):
    rows=[json.loads(s) for s in Path(path).read_text().splitlines() if s.strip()]
    assert len(rows)==7, f"expected 7 sanitized histories, got {len(rows)}"
    seen=set()
    for row in rows:
        assert set(row)=={"case","world","events","effects","revoked","epoch"}
        assert "HUSH069_TEST_" not in json.dumps(row)
        kind=row["case"];assert kind in EXPECTED
        expected=EXPECTED[kind]
        assert (row["events"],row["effects"],row["revoked"],row["epoch"])==expected,(kind,row)
        key=(kind,row["world"]);assert key not in seen,key
        seen.add(key)
    assert seen=={
        ("stale_race","zero"),("stale_race","one"),
        ("guarded_revoke_first","zero"),("guarded_revoke_first","one"),
        ("guarded_commit_first","zero"),("guarded_crash_restart","zero"),("orphan_lock","zero")
    }
    return {"experiment":"HUSH-069","histories":len(rows),
            "stale_race_worlds":2,"guarded_revoke_first_worlds":2,
            "credential_exposure_in_replay":False,"production_release":"BLOCKED"}
if __name__=="__main__":
    print(json.dumps(replay(sys.argv[1]),sort_keys=True))
