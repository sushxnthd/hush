import {ActionBroker} from './action-broker.js';

/**
 * HUSH-066 research-only opt-in broker.
 *
 * Holds the same cooperative local-filesystem lock used by durable
 * authorization writers across the entire async adapter-promise interval.
 * A successful durable revocation cannot interleave with a dispatch protected
 * by this lock. An attempted revocation may FAIL instead of taking effect;
 * provider-side delayed effects, crash/restart and cancellation are NOT
 * covered. Do not expose this as a production security guarantee.
 */
export class EffectFencedActionBroker extends ActionBroker {
  async execute(input={}){
    const ticket=this._ticket(input.actionId);
    // Already-consumed/denied tickets cannot dispatch again.
    if(ticket.deniedAt||ticket.attemptedAt||ticket.consumedAt)
      return super.execute(input);
    if(!ticket.transactionId)
      return this._denyBeforeDispatch(ticket,{reason:'EFFECT_FENCE_TRANSACTION_REQUIRED'});
    const store=this.authorizationStateStore;
    if(typeof store?.withExclusiveLockAsync!=='function')
      return this._denyBeforeDispatch(ticket,{reason:'EFFECT_FENCE_DURABLE_STORE_REQUIRED'});
    try{
      // super.execute rechecks the durable authorization under this lock,
      // resolves credentials, and awaits the adapter. All cooperating
      // cross-process closers must acquire the same lock to commit.
      return await store.withExclusiveLockAsync(()=>super.execute(input));
    }catch(error){
      // An error after adapter invocation cannot be called a no-effect denial.
      // Never reflect untrusted exception messages or credentials to clients.
      if(ticket.receipt)
        return {decision:'error',reason:'Effect-fence integrity indeterminate; external effects may have occurred.',rawCredentialIncluded:false};
      const reason=error?.message==='AUTHORIZATION_STATE_LOCKED'
        ?'EFFECT_FENCE_LOCK_UNAVAILABLE'
        :'EFFECT_FENCE_ERROR_EFFECT_MAY_HAVE_OCCURRED';
      return this._denyBeforeDispatch(ticket,{reason});
    }
  }
}
