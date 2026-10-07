// A deliberately labelled, sample-data simulation. No fetch, storage or AI calls.
const $ = selector => document.querySelector(selector);
const tabs = [...document.querySelectorAll('[data-demo-tab]')];
function selectTab(tab) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault(); selectTab(tabs[next]); tabs[next].focus();
  });
});
function updateFlight() {
  const budget = Number($('#demo-budget').value);
  const flights = [
    {id:'flight-c', name:'Flight C', price:1800, arrival:'09:00'},
    {id:'flight-b', name:'Flight B', price:900, arrival:'10:30'},
    {id:'flight-a', name:'Flight A', price:700, arrival:'12:00'}
  ];
  const candidate = flights.find(flight => flight.price <= budget);
  $('#private-budget').textContent = `Budget: ₹${budget.toLocaleString('en-IN')}`;
  $('#flight-result').textContent = candidate ? `Choose ${candidate.name}` : 'No matching flight';
  $('#flight-detail').textContent = candidate
    ? `₹${candidate.price.toLocaleString('en-IN')} · arrives at ${candidate.arrival}`
    : 'None of the sample flights fits this budget.';
  $('#flight-json').textContent = JSON.stringify({candidateId:candidate?.id ?? null});
  $('#demo-status').textContent = 'Sample decision updated locally. No data was sent.';
}
$('#demo-budget').addEventListener('change', updateFlight);
function memoryChoice(approved) {
  $('#memory-status').textContent = approved ? 'Approved by you' : 'Rejected by you';
  $('#memory-list').textContent = approved ? 'I prefer concise answers.' : 'No approved memories.';
  $('#forget-memory').hidden = !approved;
  $('#approve-memory').disabled = true; $('#reject-memory').disabled = true;
  $('#demo-status').textContent = approved ? 'Sample memory approved for this walkthrough.' : 'Sample memory rejected.';
}
$('#approve-memory').addEventListener('click', () => memoryChoice(true));
$('#reject-memory').addEventListener('click', () => memoryChoice(false));
$('#forget-memory').addEventListener('click', () => {
  $('#memory-list').textContent = 'No approved memories.';
  $('#memory-status').textContent = 'Forgotten by you'; $('#forget-memory').hidden = true;
  $('#demo-status').textContent = 'Sample memory removed from this page.';
});
function actionChoice(allowed) {
  $('#action-receipt').textContent = allowed
    ? 'Sample receipt: allowed once · send the displayed message to teammate@example.com. No real message was sent.'
    : 'Sample receipt: denied · no permission granted and no message sent.';
  $('#allow-action').disabled = true; $('#deny-action').disabled = true;
  $('#demo-status').textContent = allowed ? 'Simulated permission recorded.' : 'Simulated request denied.';
}
$('#allow-action').addEventListener('click', () => actionChoice(true));
$('#deny-action').addEventListener('click', () => actionChoice(false));
$('#reset-demo').addEventListener('click', () => {
  $('#demo-budget').value = '1000'; updateFlight();
  $('#memory-status').textContent = 'Waiting for your choice';
  $('#memory-list').textContent = 'No approved memories yet.'; $('#forget-memory').hidden = true;
  $('#action-receipt').textContent = 'Waiting for your approval. No message has been sent.';
  ['approve-memory','reject-memory','allow-action','deny-action'].forEach(id => { document.getElementById(id).disabled = false; });
  selectTab(tabs[0]);
  $('#demo-status').textContent = 'Walkthrough reset. All sample decisions cleared.';
});
