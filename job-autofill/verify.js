const URL = "http://localhost:3001/api";

async function run() {
  try {
    const cRes = await fetch(`${URL}/auth/register`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email: `c${Date.now()}@x.com`, password:'1', role:'company'}) });
    const cData = await cRes.json();
    const cid = cData.user.id;

    const jRes = await fetch(`${URL}/jobs`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title:'Dev', company_id:cid, company:'C', location:'NY', type:'Full', salary:'1k', logo:'x', description:'d', skills:'s' }) });
    const jidReq = await fetch(`${URL}/jobs`);
    const jidData = await jidReq.json();
    const jid = jidData.jobs.find(j=>j.company==='C').id;

    const uRes = await fetch(`${URL}/auth/register`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email: `u${Date.now()}@x.com`, password:'1', role:'user'}) });
    const uData = await uRes.json();
    const uid = uData.user.id;

    // Apply
    const appRes = await fetch(`${URL}/applications`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId: uid, jobId: jid}) });
    const appId = (await appRes.json()).applicationId;

    // Save job
    await fetch(`${URL}/user/${uid}/saved-jobs`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({jobId: jid}) });
    
    // Propose Slot
    await fetch(`${URL}/applications/${appId}/interview`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({available_slots: ['10AM', '11AM']}) });

    // Confirm Slot
    await fetch(`${URL}/applications/${appId}/confirm-slot`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({selected_slot: '10AM'}) });

    // Message
    await fetch(`${URL}/applications/${appId}/messages`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({sender_id: uid, message: 'Hi'}) });
    const mRes = await fetch(`${URL}/applications/${appId}/messages`);
    const msgs = await mRes.json();

    console.log("Test OK! Message:", msgs.messages[0].message);
  } catch(e) { console.error("Test Error:", e); }
}
run();
