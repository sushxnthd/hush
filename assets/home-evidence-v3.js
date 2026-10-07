window.initHushEvidenceV3=()=>{
  if(window.__hushEvidenceV3)return;window.__hushEvidenceV3=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const prod=$('#production');if(!prod)return;
  prod.classList.add('evidence-v3');

  const latency=prod.querySelector('.stat[style*="grid-area: latency"]');
  if(latency)latency.innerHTML=`
    <span class="stat-label">Privacy × utility<small>Scientific Superiority v1 · 4,000 paired tasks</small></span>
    <table class="evidence-ledger-v3" aria-label="Utility and exact private attributes by path">
      <thead><tr><th>Path</th><th>Utility</th><th>Exact attrs</th></tr></thead>
      <tbody>
        <tr class="is-hush"><th>Hush</th><td>100.000%</td><td>0.000</td></tr>
        <tr><th>Coarse</th><td>84.125%</td><td>0.938</td></tr>
        <tr><th>Raw exact</th><td>100.000%</td><td>2.000</td></tr>
      </tbody>
    </table>`;

  const tokens=prod.querySelector('.stat[style*="grid-area: tokens"]');
  if(tokens){const label=$('.stat-label',tokens);if(label)label.innerHTML='Bounded decisions<small>4 connectors · 160 controlled cases</small>';const n=$('.stat-n',tokens);if(n)n.innerHTML='160<span class="stat-unit">/160</span>'}

  const orgs=prod.querySelector('.stat[style*="grid-area: orgs"]');
  if(orgs)orgs.innerHTML=`
    <span class="stat-label">Frozen scientific gates<small>AgentCIBench · external holdout</small></span>
    <span class="stat-n">8<span class="stat-unit">/8</span></span>
    <div class="gate-marks-v3" aria-label="Eight of eight frozen gates passed">${Array.from({length:8},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>`;

  const cells=(kind)=>Array.from({length:50},(_,i)=>`<i class="${kind}" style="--i:${i}"></i>`).join('');
  const bench=$('.stat-bench',prod);
  if(bench)bench.innerHTML=`
    <div class="bench-half evidence-detector-v3">
      <span class="stat-label">Independent detector<small>AgentLeak · 50 paired ActionBroker traces</small></span>
      <div class="detector-result-v3"><span class="stat-n">0<span class="stat-unit">%</span></span><p>credential-canary leakage on Hush, with <b>100% task success</b>.</p></div>
      <div class="trace-matrix-v3" aria-label="Fifty paired traces: Hush protected all credential canaries while the naive comparator leaked all fifty">
        <div class="trace-row-v3"><span>Hush</span><div class="trace-cells-v3 hush">${cells('safe')}</div><b>0/50</b></div>
        <div class="trace-row-v3"><span>Naive</span><div class="trace-cells-v3 naive">${cells('leak')}</div><b>50/50</b></div>
      </div>
      <div class="evidence-foot-v3">credential canary exposures · lower is better</div>
    </div>
    <div class="bench-half evidence-agentci-v3">
      <span class="stat-label">Frozen external holdout<small>AgentCIBench · 50 cases</small></span>
      <div class="agentci-head-v3"><span class="stat-n">15.4<span class="stat-unit">%↓</span></span><span>relative exact protected-context violation</span></div>
      <div class="agentci-scale-v3" aria-label="Hush protected-context violation 0.796 versus semantic-only 0.941">
        <div class="agentci-axis-v3"><span class="axis-start">0</span><span class="axis-end">1</span></div>
        <div class="agentci-bracket-v3"><span>−15.4% relative</span></div>
        <i class="agentci-marker-v3 hush"><b>Hush</b><em>.796</em></i>
        <i class="agentci-marker-v3 semantic"><b>Semantic</b><em>.941</em></i>
      </div>
      <div class="agentci-meta-v3"><strong>95.07%</strong> completeness <i></i> <strong>6–0</strong> paired leak-free wins <i></i> p=.03125</div>
    </div>`;

  const ours=$('.stat-ours',prod);
  if(ours)ours.innerHTML=`
    <div class="ours-head evidence-ours-head-v3">
      <span class="stat-label">Scientific Superiority v1<small>preregistered internal paired protocol</small></span>
      <dl class="pair"><div><dt>Oracle agreement</dt><dd><span class="stat-n sm">100<span class="stat-unit">%</span></span><span class="delta">Hush</span></dd></div><div><dt>Exact private attrs</dt><dd><span class="stat-n sm">0.000</span><span class="delta">per task</span></dd></div></dl>
    </div>
    <figure class="research-figure-v3" aria-labelledby="research-figure-v3-title">
      <div class="research-figure-head-v3"><div><span>Figure 1 · privacy–utility frontier</span><h4 id="research-figure-v3-title">Useful answers without exact private disclosure</h4></div><div class="figure-key-v3"><i></i> preferred region</div></div>
      <svg class="privacy-frontier-v3" viewBox="0 0 760 430" role="img" aria-label="Hush achieves 100 percent oracle agreement at zero exact private attributes; coarse disclosure achieves 84.125 percent at 0.938 attributes; raw exact disclosure achieves 100 percent at 2 attributes">
        <rect class="preferred-zone-v3" x="84" y="42" width="128" height="74"></rect>
        <text class="preferred-label-v3" x="96" y="62">HIGH UTILITY / LOW DISCLOSURE</text>
        <g class="grid-v3"><line x1="84" y1="330" x2="724" y2="330"></line><line x1="84" y1="258" x2="724" y2="258"></line><line x1="84" y1="186" x2="724" y2="186"></line><line x1="84" y1="114" x2="724" y2="114"></line><line x1="84" y1="42" x2="724" y2="42"></line></g>
        <g class="axis-v3"><line x1="84" y1="42" x2="84" y2="330"></line><line x1="84" y1="330" x2="724" y2="330"></line></g>
        <g class="ticks-v3"><text x="70" y="334" text-anchor="end">80%</text><text x="70" y="262" text-anchor="end">85%</text><text x="70" y="190" text-anchor="end">90%</text><text x="70" y="118" text-anchor="end">95%</text><text x="70" y="46" text-anchor="end">100%</text><text x="84" y="354" text-anchor="middle">0.000</text><text x="384" y="354" text-anchor="middle">0.938</text><text x="724" y="354" text-anchor="middle">2.000</text></g>
        <text class="axis-title-v3" x="404" y="397" text-anchor="middle">EXACT PRIVATE INPUT ATTRIBUTES / TASK →</text><text class="axis-title-v3" x="19" y="186" text-anchor="middle" transform="rotate(-90 19 186)">ORACLE AGREEMENT →</text>
        <g class="guides-v3"><line class="hush-guide-v3" x1="84" y1="42" x2="84" y2="330"></line><line class="hush-guide-v3" x1="84" y1="42" x2="724" y2="42"></line><line x1="384" y1="271" x2="384" y2="330"></line><line x1="724" y1="42" x2="724" y2="330"></line></g>
        <g class="points-v3"><rect class="point-v3 hush" x="77" y="35" width="14" height="14"></rect><circle class="point-v3 baseline coarse" cx="384" cy="271" r="7"></circle><circle class="point-v3 baseline raw" cx="724" cy="42" r="7"></circle></g>
        <g class="labels-v3"><text class="label-hush" x="101" y="39">HUSH · 100%</text><text class="label-sub" x="101" y="57">0.000 exact attributes</text><text x="399" y="267">COARSE · 84.125%</text><text class="label-sub" x="399" y="285">0.938 exact attributes</text><text x="709" y="69" text-anchor="end">RAW EXACT · 100%</text><text class="label-sub" x="709" y="87" text-anchor="end">2.000 exact attributes</text></g>
      </svg>
      <div class="reconstruction-v3">
        <div class="reconstruction-copy-v3"><span>Adaptive reconstruction</span><strong>Exact secret recovery</strong><small>512 independently generated 16-bit secrets</small></div>
        <div class="reconstruction-axis-v3"><span class="recon-track-v3"></span><i class="recon-marker-v3 hush"><b>Hush</b><em>0%</em></i><i class="recon-marker-v3 raw"><b>Unprotected</b><em>100%</em></i></div>
        <div class="reconstruction-note-v3"><b>8</b> answers released <i></i> <b>256</b> candidates remain</div>
      </div>
      <figcaption><b>Claim boundary.</b> The 4,000-task result is a Hush-authored synthetic paired protocol. AgentCIBench is an independently originated frozen holdout and AgentLeak is a pinned independent detector over Hush-generated traces. None is a security certification or independent third-party reproduction.</figcaption>
    </figure>`;
};
