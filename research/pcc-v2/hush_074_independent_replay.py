#!/usr/bin/env python3
"""HUSH-074 independent trace oracle; never imports ActionBroker."""
import argparse
import copy
import json
from pathlib import Path

CERTS = ('requireObservableClosureCertificate', 'requireLifecycleTraceCertificate')
NAMES = set(CERTS) | {'legacy_' + x for x in CERTS} | {'ordinary_approved'}

def check(trace):
    if not isinstance(trace, dict) or trace.get('schema') != 'hush-074-v1' or type(trace.get('prepatch')) is not bool:
        raise ValueError('BAD_SCHEMA')
    scenarios = trace.get('scenarios')
    if not isinstance(scenarios, list) or len(scenarios) != 5:
        raise ValueError('BAD_COUNT')
    rows = {}
    for r in scenarios:
        if not isinstance(r, dict) or set(r) != {'name','requested','decision','effects','adapterEntries','queue'}:
            raise ValueError('BAD_ROW')
        n = r['name']
        if not isinstance(n, str) or n not in NAMES or n in rows:
            raise ValueError('BAD_NAME')
        if type(r['requested']) is not bool or any(type(r[k]) is not int or r[k] < 0 for k in ('effects','adapterEntries','queue')):
            raise ValueError('BAD_TYPES')
        rows[n] = r
    if set(rows) != NAMES:
        raise ValueError('MISSING')
    for n in CERTS:
        r = rows[n]
        want = (True,'allow',1) if trace['prepatch'] else (False,'REQUEST_REJECTED',0)
        if (r['requested'],r['decision'],r['effects']) != want or r['adapterEntries'] != want[2] or (not trace['prepatch'] and r['queue'] != 0):
            raise ValueError('CERTIFICATE_BYPASS')
        r = rows['legacy_'+n]
        want = ('allow',1) if trace['prepatch'] else ('deny',0)
        if not r['requested'] or (r['decision'],r['effects']) != want or r['adapterEntries'] != want[1]:
            raise ValueError('LEGACY_DISPATCH_BYPASS')
    r = rows['ordinary_approved']
    if not r['requested'] or (r['decision'],r['effects'],r['adapterEntries']) != ('allow',1,1):
        raise ValueError('LEGITIMATE_CONTROL_FAILED')
    return {'result':'PASS','prepatch':trace['prepatch'],
            'required_cert_effects':sum(rows[n]['effects'] for n in CERTS),
            'legacy_bypass_effects':sum(rows['legacy_'+n]['effects'] for n in CERTS),
            'ordinary_effects':1}

def self_test():
    rows=[]
    for n in CERTS:
        rows.append(dict(name=n,requested=False,decision='REQUEST_REJECTED',effects=0,adapterEntries=0,queue=0))
        rows.append(dict(name='legacy_'+n,requested=True,decision='deny',effects=0,adapterEntries=0,queue=1))
    rows.append(dict(name='ordinary_approved',requested=True,decision='allow',effects=1,adapterEntries=1,queue=1))
    base={'schema':'hush-074-v1','prepatch':False,'scenarios':rows}
    assert check(base)['result']=='PASS'
    for idx,key,value in [(0,'effects',1),(1,'decision','allow'),(2,'name',rows[0]['name']),(4,'effects',0)]:
        x=copy.deepcopy(base);x['scenarios'][idx][key]=value
        try: check(x)
        except ValueError: pass
        else: raise AssertionError('TAMPER_NOT_DETECTED')
    x=copy.deepcopy(base);x['prepatch']='false'
    try: check(x)
    except ValueError: pass
    else: raise AssertionError('TAMPER_NOT_DETECTED')
    print(json.dumps({'self_test':'PASS','tamper_controls':5},sort_keys=True))

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('trace',nargs='?')
    ap.add_argument('--self-test',action='store_true')
    args=ap.parse_args()
    if args.self_test: self_test()
    else:
        if not args.trace: ap.error('trace required')
        print(json.dumps(check(json.loads(Path(args.trace).read_text())),sort_keys=True))
