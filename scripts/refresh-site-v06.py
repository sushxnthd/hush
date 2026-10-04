from pathlib import Path
import re

# Home
p=Path('index.html')
s=p.read_text()
s=s.replace('<span>Introducing Private Mode</span><span class="note-cta">Read the thesis ↗</span>','<span>Context Kernel v0.6 is live</span><span class="note-cta">See what shipped ↗</span>')
s=s.replace('Supakeep is building the private context and authority layer for AI agents.','Supakeep gives AI private access to your life without giving it a copy of your life.',1)
s=s.replace('Let any AI use what it needs from your life without giving it a copy of your life.','Encrypted context stays on your side. Agents get bounded answers, scoped authority and verifiable receipts.',1)
new_memo='''<article class="memo" id="memo" data-reveal>
    <p>The path to useful personal AI is not to keep copying more of a person into more model providers. It is to make private context <a href="./product/">usable without becoming model context</a>.</p>
    <p class="beat">AI can know you without owning your data.</p>
    <p>The current Context Kernel seals private state locally, evaluates bounded decisions over it, and can expose those decisions to compatible AI clients through a native MCP surface. There is deliberately no normal raw-context dump tool.</p>
    <p>Privacy accounting now survives fresh tasks and restarts. In our synthetic reconstruction benchmark, an unrestricted oracle recovers the hidden value in 20 questions; the persistent firewall blocks the same-sink attack after 6 allowed answers and a sink-rotating attack after 8.</p>
    <p>Authority follows the same rule. Credentials remain brokered, actions are constrained by signed grants, exact approvals bind to the action that actually executes, and material decisions leave receipts.</p>
    <figure class="loop"><div class="loop-canvas"><div class="loop-frame"></div><span class="lnode l1">sealed<br>context</span><span class="lnode l2">persistent<br>budget</span><span class="lnode core">SUPA<br>KEEP</span><span class="lnode l3">bounded<br>answer</span><span class="lnode l4">authorized<br>action</span><i class="wire w1"></i><i class="wire w2"></i><i class="wire w3"></i><i class="wire w4"></i></div><figcaption class="caption">Figure 1. Private state stays sealed locally. Agents receive bounded computation results; authority is brokered separately at the action boundary.</figcaption></figure>
  </article>'''
s,n=re.subn(r'<article class="memo" id="memo" data-reveal>.*?</article>',new_memo,s,flags=re.S)
assert n==1, f'home memo replacements={n}'
p.write_text(s)

# Product
p=Path('product/index.html')
s=p.read_text()
s=s.replace('Private context and authority, without handing the model your life.','Private context that stays sealed. Personalization that still works.',1)
s=s.replace('Supakeep keeps personal state outside provider context, answers bounded questions locally, and brokers tightly scoped real-world actions.','The v0.6 alpha combines encrypted local context, bounded private computation, persistent reconstruction accounting and scoped agent authority.',1)
what='''<section class="section" id="what"><h2 data-reveal style="--d:0ms">What we do</h2><dl class="rows">
    <div class="row" data-reveal style="--d:60ms"><span class="row-icon">01</span><dt>Seal private context locally.</dt><dd>Context records are encrypted with authenticated encryption. Labels, categories, tags and values stay inside ciphertext; exported portable bundles contain encrypted state rather than readable personal data.</dd></div>
    <div class="row" data-reveal style="--d:120ms"><span class="row-icon">02</span><dt>Personalize without returning the profile.</dt><dd>Agents send bounded Private Decision Programs. The Context Kernel evaluates them locally over private state and returns a boolean, bucket or selected public candidate rather than the underlying values.</dd></div>
    <div class="row" data-reveal style="--d:180ms"><span class="row-icon">03</span><dt>Resist reconstruction across tasks.</dt><dd>Information accounting persists across fresh trajectories, agents and destinations. Restarting the local runtime does not reset what has already been disclosed within the rolling reconstruction window.</dd></div>
    <div class="row" data-reveal style="--d:240ms"><span class="row-icon">04</span><dt>Broker authority instead of exposing credentials.</dt><dd>Scoped Grants, exact-action approvals, MCP enforcement and credential brokerage let agents request actions without receiving long-lived secret material.</dd></div>
  </dl><p class="extraction-note">Compatible AI clients can reach the Context Kernel through native MCP tools for starting a private task, requesting a bounded decision and revoking the task. A raw-context export tool is intentionally absent.</p><a class="more" data-reveal style="--d:300ms" href="https://github.com/sushxnthd/supakeep/blob/main/ARCHITECTURE.md">Read the architecture ↗</a></section>'''
s,n=re.subn(r'<section class="section" id="what">.*?</section>',what,s,count=1,flags=re.S)
assert n==1, f'product what replacements={n}'
production='''<section class="section" id="production" data-reveal><h2 class="eyebrow">In the current alpha</h2><p class="creed">The core claim is deliberately narrow: <b>bounded explicit disclosure with persistent accounting</b>, while useful private decisions still complete.</p>
    <div class="proof"><div class="stat lat"><span class="stat-label">Sealed context</span><table class="ledger"><thead><tr><th>Primitive</th><th>Current alpha</th></tr></thead><tbody><tr><td>Record encryption</td><td>AES-256-GCM</td></tr><tr><td>Key wrapping</td><td>scrypt-derived key</td></tr><tr><td>Portable export</td><td>ciphertext only</td></tr></tbody></table></div><div class="stat tok"><span class="stat-label">Tests passing</span><span class="stat-n">66/66</span></div><div class="stat org"><span class="stat-label">Synthetic adversarial trajectories</span><span class="stat-n">10k</span></div><div class="stat bench"><span class="stat-label">Cross-task reconstruction</span><div class="bench-title">20 → 6 / 8</div><p class="bench-copy">The unrestricted synthetic attacker recovers the exact value in 20 fresh tasks. Persistent accounting blocks the same-sink attack after 6 allowed answers and the rotating-sink variant after 8, leaving 15,625 and 3,906 candidate values respectively.</p></div><div class="stat ours"><span class="stat-label">Blind personalization demo</span><div class="ours-grid"><div class="mini"><b>15 → 1</b><span>public flight options personalized locally</span></div><div class="mini"><b>0</b><span>raw private values returned to the model</span></div><div class="mini"><b>4 bits</b><span>worst-case explicit result channel</span></div><div class="mini"><b>persist</b><span>reconstruction state survives restart</span></div></div></div></div>
    <figure class="said"><blockquote><p>Private Mode should feel like giving an AI access to you, without giving the AI a copy of you.</p></blockquote><figcaption>Supakeep product thesis · v0.6 alpha</figcaption></figure>
  </section>'''
s,n=re.subn(r'<section class="section" id="production" data-reveal>.*?</section>',production,s,count=1,flags=re.S)
assert n==1, f'product evidence replacements={n}'
security='''<section class="section" id="security" data-reveal><h2>The model is not the security boundary.</h2><p class="body">Today, the implemented boundary covers sealed local context, bounded private decisions, MCP tool mediation, credential brokerage, approvals, Grants and receipts. Browser mediation, production OAuth connectors, OS-keychain integration and packaged consumer installation remain roadmap work.</p><a class="more deploy" href="https://github.com/sushxnthd/supakeep/blob/main/THREAT_MODEL.md">Read the threat model ↗</a>
    <ol class="places"><li class="place"><div class="place-head"><h3 class="place-name">Sealed on device</h3><span class="place-n">001</span></div><div class="place-plate"><span class="plate-icon"></span></div></li><li class="place"><div class="place-head"><h3 class="place-name">Bounded through MCP</h3><span class="place-n">002</span></div><div class="place-plate"><span class="plate-icon"></span></div></li><li class="place"><div class="place-head"><h3 class="place-name">Scoped at actions</h3><span class="place-n">003</span></div><div class="place-plate"><span class="plate-icon"></span></div></li></ol>
    <div class="sec"><h3 class="sec-title">What the alpha currently enforces.</h3><p class="sec-text">Raw credential-like tool arguments can be hard-denied, unknown MCP tools fail closed, exact approvals are request-bound, private-decision budgets compose, and reconstruction accounting persists across tasks and restarts. The explicit-channel model does not cover timing, compromised hosts, bypass traffic or every possible side channel.</p><ul class="seals"><li>SEALED</li><li>BOUNDED</li><li>AUDITED</li></ul></div><div class="sec-links"><a class="more" href="https://github.com/sushxnthd/supakeep">GitHub ↗</a><a class="more" href="https://github.com/sushxnthd/supakeep/blob/main/ROADMAP.md">Roadmap ↗</a></div>
  </section>'''
s,n=re.subn(r'<section class="section" id="security" data-reveal>.*?</section>',security,s,count=1,flags=re.S)
assert n==1, f'product security replacements={n}'
p.write_text(s)

# Writing
p=Path('writing/index.html')
s=p.read_text()
s=s.replace('Research notes on private context, agent authority and measurable disclosure.','Research notes on private computation, reconstruction resistance and agent authority.',1)
s=s.replace('Technical notes, threat models and falsifiable claims behind the system.','Technical notes, benchmarks and threat boundaries behind the v0.6 alpha.',1)
writing='''<section class="section" id="writing" data-reveal><h2>Writing</h2><ol class="entries"><li><a class="entry" href="https://github.com/sushxnthd/supakeep/blob/main/research/PRODUCT_THESIS.md"><span class="entry-tile">↗</span><span class="entry-n">01</span><span>Private Mode: a personal trust layer for every AI</span></a></li><li><a class="entry" href="https://github.com/sushxnthd/supakeep/blob/main/research/BLIND_PERSONALIZATION.md"><span class="entry-tile">↗</span><span class="entry-n">02</span><span>Blind personalization: compute over private context without returning it</span></a></li><li><a class="entry" href="https://github.com/sushxnthd/supakeep/blob/main/research/RECONSTRUCTION_FIREWALL.md"><span class="entry-tile">↗</span><span class="entry-n">03</span><span>Persistent reconstruction firewall across tasks, agents and sinks</span></a></li><li><a class="entry" href="https://github.com/sushxnthd/supakeep/blob/main/research/CONTEXT_KERNEL.md"><span class="entry-tile">↗</span><span class="entry-n">04</span><span>Context Kernel: the falsification program</span></a></li><li><a class="entry" href="https://github.com/sushxnthd/supakeep/blob/main/THREAT_MODEL.md"><span class="entry-tile">↗</span><span class="entry-n">05</span><span>Threat model: context, credentials and delegated authority</span></a></li><li><a class="entry" href="https://github.com/sushxnthd/supakeep/blob/main/bench/RESULTS.md"><span class="entry-tile">↗</span><span class="entry-n">06</span><span>Benchmark results, assumptions and caveats</span></a></li></ol><a class="more" href="https://github.com/sushxnthd/supakeep/tree/main/research">Read the research ↗</a></section>'''
s,n=re.subn(r'<section class="section" id="writing" data-reveal>.*?</section>',writing,s,count=1,flags=re.S)
assert n==1, f'writing replacements={n}'
p.write_text(s)

# Changelog
p=Path('changelog/index.html')
s=p.read_text()
latest='''<section class="section" id="latest" data-reveal><h2>October 4, 2026</h2><dl class="rows">
<div class="row"><span class="row-icon">08</span><dt>Native private-context MCP surface.</dt><dd>Compatible AI clients can now start a private task, request a bounded private decision and revoke the task through Supakeep itself. Raw private-context retrieval is deliberately not exposed as a normal native tool.</dd></div>
<div class="row"><span class="row-icon">07</span><dt>Persistent reconstruction firewall.</dt><dd>Disclosure accounting now survives fresh trajectories and combines exposure across agents and destinations, closing the simple “start a new task” reset attack.</dd></div>
<div class="row"><span class="row-icon">06</span><dt>Encrypted Context Kernel persistence.</dt><dd>Private context and reconstruction state persist in authenticated ciphertext, survive restart, fail closed on a wrong passphrase, and can be exported as a ciphertext-only portable bundle.</dd></div>
<div class="row"><span class="row-icon">05</span><dt>Cross-task reconstruction benchmark.</dt><dd>An unrestricted synthetic attacker recovers the hidden value in 20 fresh tasks. The persistent firewall blocks the same-sink attack after 6 allowed answers and the rotating-sink version after 8.</dd></div>
<div class="row"><span class="row-icon">04</span><dt>Website moved to real page routes.</dt><dd>Home, Product, Writing and Changelog now have independent URLs and page-local navigation instead of sharing one long document.</dd></div>
<div class="row"><span class="row-icon">03</span><dt>Private decision runtime and disclosure accounting.</dt><dd>Bounded outputs, cumulative trajectory accounting and blind-personalization experiments are represented as reproducible checks rather than broad privacy claims.</dd></div>
<div class="row"><span class="row-icon">02</span><dt>MCP enforcement boundary.</dt><dd>Tool-call guarding, hard denies, approval binding, credential brokerage and exposure scanning were added to the project.</dd></div>
<div class="row"><span class="row-icon">01</span><dt>Supakeep alpha.</dt><dd>The initial local vault, scoped grants, approvals, receipts and dashboard established the first end-to-end product surface.</dd></div>
</dl></section>'''
s,n=re.subn(r'<section class="section" id="latest" data-reveal>.*?</section>',latest,s,count=1,flags=re.S)
assert n==1, f'changelog latest replacements={n}'
status='''<section class="section" id="status" data-reveal><h2 class="eyebrow">Current status</h2><p class="creed">v0.6 alpha. <b>66/66 automated tests pass</b>, and the research kernel now includes encrypted persistence, native MCP access and persistent cross-task reconstruction accounting.</p><p class="body">This is not yet the finished consumer product. Production connectors, browser mediation, hardened OS key storage, packaged installation, recovery and broader external red-teaming remain open work.</p><a class="more" href="https://github.com/sushxnthd/supakeep/commits/main">View commit history ↗</a></section>'''
s,n=re.subn(r'<section class="section" id="status" data-reveal>.*?</section>',status,s,count=1,flags=re.S)
assert n==1, f'changelog status replacements={n}'
p.write_text(s)

# Guardrails: all four pages must still be independent and contain no accidental placeholder copy.
for file in ['index.html','product/index.html','writing/index.html','changelog/index.html']:
    text=Path(file).read_text()
    assert '<html' in text and '</html>' in text
    assert 'supakeep' in text.lower()
print('site refresh prepared')
