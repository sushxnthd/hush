#!/usr/bin/env python3
"""Second development sweep: minimal source-grounded token masking.

This imports the already-audited development harness and changes only the
mechanism configurations. It still uses spent PrivacyLens main data plus the
opened ConfAIde subset. The CultureBank holdout remains untouched.
"""
from __future__ import annotations

import grounded_guard_dev as base

base.CONFIGS=(
    {"id":"s3c55m20","minOverlapTokens":3,"minCoverage":0.55,"minWeightedCoverage":0.60,"minJaccard":0.12,"minChars":18,"redactionStrategy":"surgical","maskFraction":0.20,"minMaskTokens":2,"maxMaskTokens":4},
    {"id":"s3c55m30","minOverlapTokens":3,"minCoverage":0.55,"minWeightedCoverage":0.60,"minJaccard":0.12,"minChars":18,"redactionStrategy":"surgical","maskFraction":0.30,"minMaskTokens":2,"maxMaskTokens":5},
    {"id":"s3c55m40","minOverlapTokens":3,"minCoverage":0.55,"minWeightedCoverage":0.60,"minJaccard":0.12,"minChars":18,"redactionStrategy":"surgical","maskFraction":0.40,"minMaskTokens":2,"maxMaskTokens":6},
    {"id":"s4c58m20","minOverlapTokens":4,"minCoverage":0.58,"minWeightedCoverage":0.62,"minJaccard":0.15,"minChars":20,"redactionStrategy":"surgical","maskFraction":0.20,"minMaskTokens":2,"maxMaskTokens":4},
    {"id":"s4c58m30","minOverlapTokens":4,"minCoverage":0.58,"minWeightedCoverage":0.62,"minJaccard":0.15,"minChars":20,"redactionStrategy":"surgical","maskFraction":0.30,"minMaskTokens":2,"maxMaskTokens":5},
    {"id":"s4c58m40","minOverlapTokens":4,"minCoverage":0.58,"minWeightedCoverage":0.62,"minJaccard":0.15,"minChars":20,"redactionStrategy":"surgical","maskFraction":0.40,"minMaskTokens":2,"maxMaskTokens":6},
    {"id":"s4c64m30","minOverlapTokens":4,"minCoverage":0.64,"minWeightedCoverage":0.68,"minJaccard":0.18,"minChars":20,"redactionStrategy":"surgical","maskFraction":0.30,"minMaskTokens":2,"maxMaskTokens":5},
    {"id":"s4c70m35","minOverlapTokens":4,"minCoverage":0.70,"minWeightedCoverage":0.74,"minJaccard":0.20,"minChars":24,"redactionStrategy":"surgical","maskFraction":0.35,"minMaskTokens":2,"maxMaskTokens":5},
    {"id":"s5c55m25","minOverlapTokens":5,"minCoverage":0.55,"minWeightedCoverage":0.60,"minJaccard":0.15,"minChars":20,"redactionStrategy":"surgical","maskFraction":0.25,"minMaskTokens":2,"maxMaskTokens":4},
    {"id":"s5c62m35","minOverlapTokens":5,"minCoverage":0.62,"minWeightedCoverage":0.66,"minJaccard":0.18,"minChars":24,"redactionStrategy":"surgical","maskFraction":0.35,"minMaskTokens":2,"maxMaskTokens":5},
)

if __name__=="__main__":
    base.main()
