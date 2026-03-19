// auto_test.js
(async () => {
    try {
        console.log("Testing Backend APIs natively...");
        const URL = "http://localhost:3001/api";
        let res, data;

        // 1. Register Company
        res = await fetch(`${URL}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: `comp${Date.now()}@example.com`, password: '123', role: 'company' })
        });
        data = await res.json();
        console.log("Register Company:", data);
        const companyId = data.user.id;

        // 2. Post Job
        res = await fetch(`${URL}/jobs`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                title: 'Software Engineer',
                company_id: companyId,
                company: 'CompInc',
                location: 'Remote',
                type: 'Full-time',
                salary: '$100k',
                logo: '🚀',
                description: 'Great job',
                skills: 'Node, React'
            })
        });
        data = await res.json();
        console.log("Post Job:", data);
        
        // Handle mock jobs vs new job ids
        let jobId;
        res = await fetch(`${URL}/jobs`);
        data = await res.json();
        jobId = data.jobs.find(j => j.company === 'CompInc').id;

        // 3. Register User
        res = await fetch(`${URL}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: `user${Date.now()}@example.com`, password: '123', role: 'user' })
        });
        data = await res.json();
        console.log("Register User:", data);
        const userId = data.user.id;

        // 4. Submit Application
        res = await fetch(`${URL}/applications`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, jobId })
        });
        data = await res.json();
        console.log("Submit App:", data);
        const appId = data.applicationId;

        // 5. Company gets their applications
        res = await fetch(`${URL}/company/applications/${companyId}`);
        data = await res.json();
        console.log("Company Apps:", data.applications.length > 0 ? 'Found Apps' : 'NO APPS');

        // 6. Schedule Interview
        const link = "https://meet.jit.si/test";
        res = await fetch(`${URL}/applications/${appId}/interview`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ meeting_link: link })
        });
        data = await res.json();
        console.log("Schedule Interview:", data);

        // 7. Check User Apps for Link
        res = await fetch(`${URL}/applications/user/${userId}`);
        data = await res.json();
        console.log("User Apps Status:", data.applications[0].status, "Link:", data.applications[0].meeting_link || 'MISSING');

    } catch (e) {
        console.error("Test Failed", e);
    }
})();
