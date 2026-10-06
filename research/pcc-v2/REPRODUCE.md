# Reproduce PCC v2 Confirmation

The confirmatory workflow is `.github/workflows/pcc-v2-p2-confirmatory.yml`.

It downloads the frozen POLAR release, verifies SHA-256 `b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266`, and runs:

```bash
node research/pcc-v2/confirm_p2.mjs /tmp/polar.json
```

Expected confirmatory result:

- P2 cases: 1,570
- raw privacy: 0.000
- raw utility: 1.000
- PCC privacy: 1.000
- PCC utility: 1.000
- PCC protected disclosures: 0 / 11,366
- all 10 preregistered gates: PASS

Reference GitHub Actions run: `37448931590`.
Artifact ID: `11404533126`.
Artifact ZIP SHA-256: `5d292438621d21ee7692b5d826620fe6f31c5caa2b2beb92b5ea89cd7d1079aa`.
