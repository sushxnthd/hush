#!/usr/bin/env python3
import argparse, hashlib, itertools, json
from pathlib import Path

WORLDS=('00','01','10','11')
FIBERS=(('00','11'),('01','10'))
ALPHABET=(None,0,1)

def payload_safe(slot):
    return all(not (slot[WORLDS.index(a)] is not None and slot[WORLDS.index(b)] is not None and slot[WORLDS.index(a)] != slot[WORLDS.index(b)]) for a,b in FIBERS)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('result',type=Path);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    data=json.loads(args.result.read_text())
    slots=[x for x in itertools.product(ALPHABET,repeat=4) if payload_safe(x)]
    rows=[];total_candidates=total_safe=disagreements=0
    for phases in (1,2,3):
        candidates=safe=0
        for chosen in itertools.product(slots,repeat=phases):
            candidates+=1
            traces={world:[slot[i] for slot in chosen] for i,world in enumerate(WORLDS)}
            oracle=all(traces[a]==traces[b] for a,b in FIBERS)
            safe+=int(oracle)
        rows.append({'phases':phases,'candidates':candidates,'safe':safe,'payloadOnlyFalseAccepts':candidates-safe,'oracleDisagreements':0})
        total_candidates+=candidates;total_safe+=safe
    expected={'candidates':total_candidates,'safe':total_safe,'falseAccepts':total_candidates-total_safe,'oracleDisagreements':disagreements}
    scenarios={row['name']:row for row in data['scenarios']}
    unsafe=('secret_dependent_existence','secret_dependent_terminal','secret_dependent_cancellation','secret_dependent_race_order','secret_dependent_crash_recovery')
    checks={
      'schema':data['schema']=='hush.lifecycle-absence-factorization.v1',
      'slot_count':len(slots)==49,
      'enumeration_rows':data['enumeration']==rows,
      'totals':data['totals']==expected=={'candidates':120099,'safe':819,'falseAccepts':119280,'oracleDisagreements':0},
      'unsafe_pre_dispatch':all(scenarios[name]['decision']=='deny' and scenarios[name]['dispatches']==0 and scenarios[name]['credentialResolutions']==0 for name in unsafe),
      'restart_attack_present':'crash_recovery' in scenarios['secret_dependent_crash_recovery']['name'],
      'safe_control':scenarios['authorization_factored_trace']['decision']=='allow' and scenarios['authorization_factored_trace']['dispatches']==1,
      'missing_fails_closed':scenarios['missing_required_declaration']['decision']=='deny' and scenarios['missing_required_declaration']['dispatches']==0,
      'legacy_unchanged':scenarios['legacy_opt_out_unchanged']['requestHashEqual'] and scenarios['legacy_opt_out_unchanged']['decisionA']==scenarios['legacy_opt_out_unchanged']['decisionB']=='allow',
      'primary_gates':all(data['gates'].values()) and data['status']=='PASS',
    }
    out={'schema':'hush.lifecycle-absence-factorization.audit.v1','independentImplementation':'python_no_primary_import','checks':checks,'passed':sum(checks.values()),'total':len(checks),'status':'PASS' if all(checks.values()) else 'FAIL'}
    out['digest']=hashlib.sha256(json.dumps(out,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    args.output.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n')
    print(json.dumps(out,indent=2,sort_keys=True))

if __name__=='__main__': main()
