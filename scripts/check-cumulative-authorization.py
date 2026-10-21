#!/usr/bin/env python3
"""Independent exhaustive checker; deliberately imports no JavaScript artifacts."""

import itertools
import json
import sys


WORLDS = range(4)
MAPS = list(itertools.product((0, 1), repeat=4))


def factors(observation, authorization):
    return all(
        authorization[i] != authorization[j] or observation[i] == observation[j]
        for i in WORLDS for j in range(i + 1, 4)
    )


def structural(global_auth, local_auths):
    return all(
        global_auth[i] != global_auth[j]
        or all(local[i] == local[j] for local in local_auths)
        for i in WORLDS for j in range(i + 1, 4)
    )


def joint_safe(global_auth, observations):
    return all(
        global_auth[i] != global_auth[j]
        or all(obs[i] == obs[j] for obs in observations)
        for i in WORLDS for j in range(i + 1, 4)
    )


def main():
    safe_obs = {auth: [obs for obs in MAPS if factors(obs, auth)] for auth in MAPS}
    systems = composable = disagreements = observation_pairs = safe_pairs = 0
    for global_auth, left_auth, right_auth in itertools.product(MAPS, repeat=3):
        systems += 1
        predicted = structural(global_auth, (left_auth, right_auth))
        oracle = True
        for left_obs, right_obs in itertools.product(safe_obs[left_auth], safe_obs[right_auth]):
            observation_pairs += 1
            safe = joint_safe(global_auth, (left_obs, right_obs))
            safe_pairs += int(safe)
            oracle &= safe
        composable += int(predicted)
        disagreements += int(predicted != oracle)

    result = {
        "authorizationSystems": systems,
        "universallyComposable": composable,
        "notUniversallyComposable": systems - composable,
        "oracleObservationPairs": observation_pairs,
        "oracleSafeObservationPairs": safe_pairs,
        "disagreements": disagreements,
        "gate": "PASS" if disagreements == 0 else "FAIL",
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if disagreements == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
